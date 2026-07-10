// firebase-service.js
// --- خدمات Firebase متوافقة مع البروتوكول المحلي file:// ---

window.FirebaseService = {
  isAvailable: () => {
    return window.firebaseDB !== undefined;
  },

  // 1. Load all data from Firestore (one-time fetch)
  loadAllData: async () => {
    if (!window.FirebaseService.isAvailable()) return null;
    const db = window.firebaseDB;
    try {
      const collections = ['clients', 'inventory', 'contracts', 'installments', 'collectorCustodies', 'treasuryTransactions', 'users', 'auditLogs', 'settings', 'brands', 'suppliers', 'supplierTransactions', 'investors', 'investorSnapshots', 'productCategories', 'products', 'productStockMovements', 'expenses'];
      const data = {};

      // مهم جداً: كل مجموعة (Collection) بتتحمّل بشكل مستقل تماماً عن الباقي.
      // قبل كده كانت كل المجموعات بتتحمّل في حلقة واحدة تحت try/catch واحد،
      // فلو مجموعة واحدة بس (زي auditLogs) اترفضت بسبب صلاحيات Firestore Rules،
      // الاستثناء كان بيلغي كل البيانات اللي اتحمّلت قبلها بالفعل (زي users)
      // ومايرجعش أي حاجة خالص. النتيجة: كل الشاشة بتفضل صفر، وحساب المستخدم
      // مش بيتلاقى فبيتكرر إنشاؤه من جديد كل مرة يسجّل فيها دخول.
      // الحل: كل مجموعة ليها try/catch خاص بيها، فلو واحدة فشلت الباقي يفضل سليم.
      await Promise.all(collections.map(async (colName) => {
        try {
          const querySnapshot = await db.collection(colName).get();
          data[colName] = [];
          querySnapshot.forEach((doc) => {
            data[colName].push(doc.data());
          });
        } catch (colError) {
          console.error(`Firebase Load Error on collection "${colName}" (تم تجاهلها ومتابعة الباقي):`, colError);
          data[colName] = [];
        }
      }));

      // Settings is a single document
      if (data.settings && data.settings.length > 0) {
        const globalSet = data.settings.find(s => s.id === 'global') || data.settings[0];
        data.settings = globalSet;
      } else {
        data.settings = null;
      }

      // Keep brands as objects for hierarchical support
      if (data.brands) {
        data.brands = data.brands.map(b => (typeof b === 'object' ? b : { name: b }));
      }

      return data;
    } catch (error) {
      console.error("Firebase Load Error:", error);
      return null;
    }
  },

  // 2. Real-time updates subscription
  subscribeToUpdates: (onDataUpdate) => {
    if (!window.FirebaseService.isAvailable()) return null;
    const db = window.firebaseDB;
    const collections = ['clients', 'inventory', 'contracts', 'installments', 'collectorCustodies', 'treasuryTransactions', 'users', 'auditLogs', 'settings', 'brands', 'suppliers', 'supplierTransactions', 'investors', 'investorSnapshots', 'productCategories', 'products', 'productStockMovements', 'expenses'];
    
    const activeListeners = [];
    
    collections.forEach(colName => {
      const unsub = db.collection(colName).onSnapshot((snapshot) => {
        let items = [];
        snapshot.forEach(doc => {
          items.push(doc.data());
        });
        
        if (colName === 'settings') {
          const globalSet = items.find(s => s.id === 'global') || items[0] || null;
          onDataUpdate('settings', globalSet);
        } else if (colName === 'brands') {
          onDataUpdate('brands', items);
        } else {
          onDataUpdate(colName, items);
        }
      }, (error) => {
        console.error(`Firebase snapshot error on collection ${colName}:`, error);
      });
      activeListeners.push(unsub);
    });
    
    return () => {
      activeListeners.forEach(unsub => unsub());
    };
  },

  // 3. Sync action to Firestore
  syncAction: async (action, payload) => {
    if (!window.FirebaseService.isAvailable()) return { success: false, reason: 'not_initialized' };
    const db = window.firebaseDB;
    try {
      switch (action) {
        // Users
        case 'addUser':
          await db.collection("users").doc(payload.id).set(payload);
          // مستند خفيف منفصل بمفتاحه Auth UID، مطلوب عشان قواعد أمان Firestore
          // تقدر تتحقق من صلاحية المستخدم (role) بسرعة وأمان وقت أي عملية قراءة/كتابة
          if (payload.authUid && payload.role) {
            await db.collection("userRoles").doc(payload.authUid).set({ role: payload.role });
          }
          break;
        case 'updateUser':
          await db.collection("users").doc(payload.id).update(payload);
          if (payload.authUid && payload.role) {
            await db.collection("userRoles").doc(payload.authUid).set({ role: payload.role }, { merge: true });
          }
          break;
        case 'deleteUser':
          await db.collection("users").doc(payload.id).delete();
          if (payload.authUid) {
            await db.collection("userRoles").doc(payload.authUid).delete();
          }
          break;

        // Clients
        case 'addClient':
          await db.collection("clients").doc(payload.id).set(payload);
          break;
        case 'updateClient':
          await db.collection("clients").doc(payload.id).update(payload);
          break;
        case 'deleteClient':
          await db.collection("clients").doc(payload.id).delete();
          break;
          
        // Inventory Devices
        case 'addDevice':
          await db.collection("inventory").doc(payload.newDevice.id).set(payload.newDevice);
          // نكتب نفس حركة الخزينة اللي اتعرضت للمستخدم محلياً بالضبط (نفس الـ id ونفس الملاحظات)
          // بدل ما نولّد حركة تانية مختلفة، عشان متبقاش في حركتين متضاربتين.
          if (payload.transaction) {
            await db.collection("treasuryTransactions").doc(payload.transaction.id).set(payload.transaction);
          }
          break;
        case 'updateDevice':
          await db.collection("inventory").doc(payload.id).update(payload);
          break;
        case 'deleteDevice':
          await db.collection("inventory").doc(payload.id).delete();
          break;

        // Device groups
        case 'deleteDeviceGroup': {
          const snapshot = await db.collection("inventory")
            .where("brand", "==", payload.brand)
            .where("name", "==", payload.name)
            .where("status", "==", "available")
            .get();
          const batch = db.batch();
          snapshot.forEach(d => {
            batch.delete(d.ref);
          });
          await batch.commit();
          break;
        }
        case 'updateDeviceGroup': {
          const snapshot = await db.collection("inventory")
            .where("brand", "==", payload.brand)
            .where("name", "==", payload.name)
            .get();
          const batch = db.batch();
          const groupUpdateData = { costPrice: payload.costPrice, sellingPrice: payload.sellingPrice, supplier: payload.supplier };
          if (payload.minQty !== undefined) groupUpdateData.minQty = payload.minQty;
          snapshot.forEach(d => {
            batch.update(d.ref, groupUpdateData);
          });
          await batch.commit();
          break;
        }

        // Contracts
        case 'addContract':
          await db.collection("contracts").doc(payload.contract.id).set(payload.contract);
          await db.collection("inventory").doc(payload.contract.deviceId).update({
            status: 'sold_installment',
            soldTo: payload.contract.clientName
          });
          if (payload.contract.downPayment > 0 && payload.transaction) {
            await db.collection("treasuryTransactions").doc(payload.transaction.id).set(payload.transaction);
          }
          const contractBatch = db.batch();
          const start = new Date(payload.contract.startDate);
          for (let i = 1; i <= payload.contract.duration; i++) {
            const dueDate = new Date(start);
            dueDate.setMonth(start.getMonth() + (i - 1));
            const instId = `${payload.contract.id}_${i}`;
            const instDoc = db.collection("installments").doc(instId);
            contractBatch.set(instDoc, {
              id: instId,
              contractId: payload.contract.id,
              clientId: payload.contract.clientId,
              clientName: payload.contract.clientName,
              clientPhone: payload.contract.clientPhone,
              guarantorName: payload.guarantorName || '',
              guarantorPhone: payload.guarantorPhone || '',
              collectorName: payload.contract.collectorName,
              installmentNum: i,
              amount: payload.contract.monthlyInstallment,
              dueDate: dueDate.toISOString().split('T')[0],
              status: 'pending',
              paidAmount: 0,
              paidDate: '',
              receiptId: '',
              delayFines: 0
            });
          }
          await contractBatch.commit();
          break;

        case 'deleteTransaction':
          await db.collection("treasuryTransactions").doc(payload.id).delete();
          break;

        case 'updateTransaction':
          await db.collection("treasuryTransactions").doc(payload.id).update({
            amount: payload.amount,
            notes: payload.notes
          });
          break;

        case 'updateContract': {
          await db.collection("contracts").doc(payload.id).update(payload);
          const snapshot = await db.collection("installments").where("contractId", "==", payload.id).get();
          const batch = db.batch();
          snapshot.forEach(d => {
            batch.update(d.ref, { collectorName: payload.collectorName });
          });
          await batch.commit();
          break;
        }

        // إعادة توليد أقساط عقد بعد تعديل بياناته المالية: بيتم حذف كل
        // الأقساط "غير المسددة" القديمة لهذا العقد فقط، ثم كتابة الأقساط
        // الجديدة المُعاد حسابها. الأقساط المسددة لا يتم لمسها إطلاقاً.
        case 'regenerateInstallments': {
          const snap = await db.collection("installments").where("contractId", "==", payload.contractId).get();
          const rgBatch = db.batch();
          snap.forEach(d => {
            if (d.data().status !== 'paid') rgBatch.delete(d.ref);
          });
          (payload.installments || []).forEach(inst => {
            rgBatch.set(db.collection("installments").doc(inst.id), inst);
          });
          await rgBatch.commit();
          break;
        }

        case 'deleteContract': {
          await db.collection("contracts").doc(payload.id).delete();
          if (payload.deviceId) {
            await db.collection("inventory").doc(payload.deviceId).update({
              status: 'available',
              soldTo: ''
            });
          }
          const snapshot = await db.collection("installments").where("contractId", "==", payload.id).get();
          const batch = db.batch();
          snapshot.forEach(d => {
            batch.delete(d.ref);
          });
          await batch.commit();
          break;
        }

        // Installments
        case 'updateInstallment':
          await db.collection("installments").doc(payload.id).update(payload);
          break;

        // Custodies (Collector collections)
        case 'addPendingCustody':
          await db.collection("collectorCustodies").doc(payload.id).set(payload);
          break;

        case 'approveCustody':
          await db.collection("collectorCustodies").doc(payload.custodyId).update({ status: 'approved' });
          if (payload.installment) {
            await db.collection("installments").doc(payload.installment.id).set(payload.installment);
          } else {
            await db.collection("installments").doc(payload.installmentId).update({ 
              status: 'paid',
              paidAmount: payload.amount,
              paidDate: payload.timestamp.split(' ')[0],
              receiptId: payload.custodyId
            });
          }
          // نكتب نفس حركة الخزينة اللي ظهرت للمستخدم محلياً بالضبط، بنفس الـ id والملاحظات التفصيلية
          if (payload.transaction) {
            await db.collection("treasuryTransactions").doc(payload.transaction.id).set(payload.transaction);
          }
          break;

        case 'deleteCustody':
          await db.collection("collectorCustodies").doc(payload.id).delete();
          break;

        // Cash sale
        case 'cashSale':
          await db.collection("inventory").doc(payload.devId).update({
            status: 'sold_cash',
            soldTo: payload.clientName
          });
          if (payload.transaction) {
            await db.collection("treasuryTransactions").doc(payload.transaction.id).set(payload.transaction);
          }
          break;

        // Treasury Transactions
        case 'addExpense': {
          if (payload.expense) {
            await db.collection("expenses").doc(payload.expense.id).set(payload.expense);
          }
          if (payload.transaction) {
            await db.collection("treasuryTransactions").doc(payload.transaction.id).set(payload.transaction);
          }
          break;
        }
        case 'deleteExpense':
          await db.collection("expenses").doc(payload.id).delete();
          if (payload.transactionId) {
            await db.collection("treasuryTransactions").doc(payload.transactionId).delete();
          }
          break;
        case 'addDeposit': {
          if (payload.transaction) {
            await db.collection("treasuryTransactions").doc(payload.transaction.id).set(payload.transaction);
          }
          break;
        }

        // Brands and Suppliers
        case 'addBrand':
          await db.collection("brands").doc(payload.id || payload.name).set(payload);
          break;
        case 'deleteBrand':
          await db.collection("brands").doc(payload.id || payload.name).delete();
          break;
        case 'addSupplier':
          await db.collection("suppliers").doc(payload.id).set(payload);
          break;
        case 'updateSupplier':
          await db.collection("suppliers").doc(payload.id).set(payload, { merge: true });
          break;
        case 'deleteSupplier':
          await db.collection("suppliers").doc(payload.id).delete();
          break;
        case 'addSupplierTransaction':
          if (payload.transaction) {
            await db.collection("supplierTransactions").doc(payload.transaction.id).set(payload.transaction);
          }
          break;
        case 'supplierPayment':
          if (payload.transaction) {
            await db.collection("treasuryTransactions").doc(payload.transaction.id).set(payload.transaction);
          }
          if (payload.supplierTransaction) {
            await db.collection("supplierTransactions").doc(payload.supplierTransaction.id).set(payload.supplierTransaction);
          }
          break;

        // General Products & Categories (الأصناف والمنتجات العامة)
        case 'addProductCategory':
          await db.collection("productCategories").doc(payload.id).set(payload);
          break;
        case 'updateProductCategory':
          await db.collection("productCategories").doc(payload.id).set(payload, { merge: true });
          break;
        case 'deleteProductCategory':
          await db.collection("productCategories").doc(payload.id).delete();
          break;
        case 'addProduct':
          await db.collection("products").doc(payload.id).set(payload);
          break;
        case 'updateProduct':
          await db.collection("products").doc(payload.id).set(payload, { merge: true });
          break;
        case 'deleteProduct':
          await db.collection("products").doc(payload.id).delete();
          break;
        case 'stockInProduct':
          await db.collection("productStockMovements").doc(payload.movement.id).set(payload.movement);
          if (payload.transaction) {
            await db.collection("treasuryTransactions").doc(payload.transaction.id).set(payload.transaction);
          }
          if (payload.supplierTransaction) {
            await db.collection("supplierTransactions").doc(payload.supplierTransaction.id).set(payload.supplierTransaction);
          }
          if (payload.product) {
            await db.collection("products").doc(payload.product.id).set(payload.product, { merge: true });
          }
          break;
        case 'stockOutProduct':
          await db.collection("productStockMovements").doc(payload.movement.id).set(payload.movement);
          if (payload.transaction) {
            await db.collection("treasuryTransactions").doc(payload.transaction.id).set(payload.transaction);
          }
          break;
        case 'addTreasuryTransaction':
          await db.collection("treasuryTransactions").doc(payload.id).set(payload);
          break;
        case 'deleteTreasuryTransaction':
          await db.collection("treasuryTransactions").doc(payload.id).delete();
          break;

        // Investors & Company Capital
        case 'addInvestor':
          await db.collection("investors").doc(payload.investor.id).set(payload.investor);
          if (payload.transaction) {
            await db.collection("treasuryTransactions").doc(payload.transaction.id).set(payload.transaction);
          }
          break;
        case 'addInvestorCapital':
          await db.collection("investors").doc(payload.investorId).update({ capitalAmount: payload.newCapitalAmount });
          if (payload.transaction) {
            await db.collection("treasuryTransactions").doc(payload.transaction.id).set(payload.transaction);
          }
          break;
        case 'withdrawInvestorProfit':
          await db.collection("investors").doc(payload.investorId).update({ totalWithdrawn: payload.newTotalWithdrawn });
          if (payload.transaction) {
            await db.collection("treasuryTransactions").doc(payload.transaction.id).set(payload.transaction);
          }
          break;
        case 'withdrawInvestorCapital':
          await db.collection("investors").doc(payload.investorId).update({ capitalAmount: payload.newCapitalAmount });
          if (payload.transaction) {
            await db.collection("treasuryTransactions").doc(payload.transaction.id).set(payload.transaction);
          }
          break;
        case 'editInvestor':
          await db.collection("investors").doc(payload.investorId).update({
            name: payload.name,
            joinDate: payload.joinDate,
            notes: payload.notes,
            fixedSharePercent: (payload.fixedSharePercent === null || payload.fixedSharePercent === undefined) ? firebase.firestore.FieldValue.delete() : payload.fixedSharePercent
          });
          break;
        case 'deleteInvestor':
          await db.collection("investors").doc(payload.id).delete();
          break;
        case 'addInvestorSnapshot':
          if (payload.snapshot) {
            await db.collection("investorSnapshots").doc(payload.snapshot.id).set(payload.snapshot);
          }
          break;
        case 'deleteInvestorSnapshot':
          await db.collection("investorSnapshots").doc(payload.id).delete();
          break;

        // Settings
        case 'updateSettings':
          await db.collection("settings").doc("global").set(payload);
          break;

        // Audit Logs
        case 'addAuditLog': {
          const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
          await db.collection("auditLogs").doc(logId).set(payload);
          break;
        }

        default:
          console.warn("Firebase sync action not recognized:", action);
          break;
      }
      return { success: true };
    } catch (error) {
      console.error("Firebase Sync Error:", error);
      return { success: false, error: error.message };
    }
  },

  // 4. Seeding helper for new setups
  seedFirebase: async (seedData) => {
    if (!window.FirebaseService.isAvailable()) return;
    const db = window.firebaseDB;
    try {
      const batch = db.batch();
      
      seedData.users.forEach(u => {
        batch.set(db.collection("users").doc(u.id), u);
      });
      seedData.brands.forEach(b => {
        batch.set(db.collection("brands").doc(b), { name: b });
      });
      seedData.suppliers.forEach(s => {
        batch.set(db.collection("suppliers").doc(s.name), s);
      });
      (seedData.investors || []).forEach(inv => {
        batch.set(db.collection("investors").doc(inv.id), inv);
      });
      seedData.clients.forEach(c => {
        batch.set(db.collection("clients").doc(c.id), c);
      });
      seedData.inventory.forEach(i => {
        batch.set(db.collection("inventory").doc(i.id), i);
      });
      seedData.contracts.forEach(c => {
        batch.set(db.collection("contracts").doc(c.id), c);
      });
      seedData.treasuryTransactions.forEach(t => {
        batch.set(db.collection("treasuryTransactions").doc(t.id), t);
      });
      seedData.auditLogs.forEach(l => {
        const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        batch.set(db.collection("auditLogs").doc(logId), l);
      });
      batch.set(db.collection("settings").doc("global"), {
        id: 'global',
        companyName: seedData.settings.companyName || 'شركة SKY',
        companyLogo: seedData.settings.companyLogo || '',
        offlineMode: false,
        templates: seedData.settings.templates
      });
      
      await batch.commit();
      console.log("Firestore initialized and seeded with default data successfully!");
    } catch (e) {
      console.error("Firebase Seeding Error:", e);
    }
  },

  // 5. Upload Image helper (Returns Base64 directly as Storage is disabled)
  uploadImage: async (base64Data, folder, filename) => {
    return base64Data;
  }
};

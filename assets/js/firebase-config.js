/* ═══════════════════════════════════════════════════════════════
   Kamilly Vitória | Beauty Art  ─  Firebase Config
   🔧 PREENCHA com os dados do seu projeto no Firebase Console
   ═══════════════════════════════════════════════════════════════ */

const FIREBASE_CONFIG = {
  apiKey:            "SUA-API-KEY",
  authDomain:        "seu-projeto.firebaseapp.com",
  projectId:         "seu-projeto-id",
  storageBucket:     "seu-projeto.appspot.com",
  messagingSenderId: "000000000000",
  appId:             "1:000000000000:web:000000000000000000000000"
};

firebase.initializeApp(FIREBASE_CONFIG);

/* Exporta como globais para main.js e admin.js */
const db   = firebase.firestore();
const auth = firebase.auth();

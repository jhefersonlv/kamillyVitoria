/* ═══════════════════════════════════════════════════════════════
   Kamilly Vitória | Beauty Art  ─  Firebase Config
   🔧 PREENCHA com os dados do seu projeto no Firebase Console
   ═══════════════════════════════════════════════════════════════ */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBU92Mx34C-qTuV_jCsK4sQ_MbK25LNg4I",
  authDomain: "kamilly-beauty-art.firebaseapp.com",
  projectId: "kamilly-beauty-art",
  storageBucket: "kamilly-beauty-art.firebasestorage.app",
  messagingSenderId: "806664103449",
  appId: "1:806664103449:web:5e9c1cfb671ea01fc36c88"
};

firebase.initializeApp(FIREBASE_CONFIG);

/* Exporta como globais para main.js e admin.js */
const db = firebase.firestore();
const auth = firebase.auth();

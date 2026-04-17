/* ═══════════════════════════════════════════════════════════════
   Kamilly Vitória | Beauty Art  ─  Firebase Config
   Conectado ao Orbit Tools (WordVirtua) como tenant
   ═══════════════════════════════════════════════════════════════ */

/* UID da Kamilly no Orbit Tools — identifica o tenant */
const TENANT_UID = 'I3vNg9lUqwfD4qTyUdEAQ7NFEbG3';

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyCMl29LbQqrqqPQR8EKa1g8Cm4rHUwLWJA',
  authDomain:        'orbit-tools-35189.firebaseapp.com',
  projectId:         'orbit-tools-35189',
  storageBucket:     'orbit-tools-35189.firebasestorage.app',
  messagingSenderId: '4218159323',
  appId:             '1:4218159323:web:bb017b569353468b4a4cfe',
};

firebase.initializeApp(FIREBASE_CONFIG);

const db   = firebase.firestore();
const auth = firebase.auth();

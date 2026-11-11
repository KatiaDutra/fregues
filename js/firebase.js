// firebase.js
// Conexão com o Firebase. Esta configuração identifica o projeto e pode ser pública:
// a proteção dos dados fica nas regras de segurança (arquivo firestore.rules).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwfTVLcOyv4iCTMlY1vwvCVPJAZFo36IU",
  authDomain: "fregues-dd1dc.firebaseapp.com",
  projectId: "fregues-dd1dc",
  storageBucket: "fregues-dd1dc.firebasestorage.app",
  messagingSenderId: "759760707306",
  appId: "1:759760707306:web:cf20294a447dfecedc0193",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

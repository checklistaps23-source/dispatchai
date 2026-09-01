// Configuration Firebase pour les Checklists véhicules
// Réutilise le projet existant "check-list-peremption" (celui d'APS Checklists),
// mais avec une collection dédiée ("dispatchai_checklists") pour ne pas
// mélanger avec les anciennes données de l'app APS Checklists.
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const checklistsFirebaseConfig = {
  apiKey: "AIzaSyAHxMNER2le2Hb65R2qXWaYRhKrjN8zJaU",
  authDomain: "check-list-peremption.firebaseapp.com",
  databaseURL: "https://check-list-peremption-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "check-list-peremption",
  storageBucket: "check-list-peremption.firebasestorage.app",
  messagingSenderId: "20359103251",
  appId: "1:20359103251:web:c52af261ee73613aa4d0e6",
};

// Nommée "checklists" pour coexister avec l'autre app Firebase (dispatchai-aps)
// initialisée dans firebase.js, sans conflit.
const checklistsApp = initializeApp(checklistsFirebaseConfig, "checklists");
export const dbChecklists = initializeFirestore(checklistsApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

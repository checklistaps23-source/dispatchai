// Configuration Firebase pour DispatchAI (projet dispatchai-aps)
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBdqAtlMJdVATFwJbQyhOEN8R50GCOB2vI",
  authDomain: "dispatchai-aps.firebaseapp.com",
  projectId: "dispatchai-aps",
  storageBucket: "dispatchai-aps.firebasestorage.app",
  messagingSenderId: "251632976678",
  appId: "1:251632976678:web:716a0b97785c238c30f7e7",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, getDocs, onSnapshot, query, orderBy, writeBatch, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';
import { FIREBASE_CONFIG } from './config.js';

const app = initializeApp(FIREBASE_CONFIG, 'bolasepak');
export const db = getFirestore(app);
export const auth = getAuth(app);
export { doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, getDocs, onSnapshot, query, orderBy, writeBatch, serverTimestamp, Timestamp, signInWithEmailAndPassword, signOut, onAuthStateChanged };

import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, updateDoc } from 'firebase/firestore';

const BloodBankManagementSystem = () => {
    const [view, setView] = useState('login');
    const [loading, setLoading] = useState(true);
    const [bloodBanks, setBloodBanks] = useState([]);
    const [userId, setUserId] = useState(null);
    const [error, setError] = useState(null);
    const [requestStatus, setRequestStatus] = useState(null);
    const [showDonateModal, setShowDonateModal] = useState(false);
    const [showLoginSuccess, setShowLoginSuccess] = useState(false);

    // You may supply these variables via environment/config system
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = typeof _firebase_config !== 'undefined' ? JSON.parse(_firebase_config) : {};
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    useEffect(() => {
        let unsubscribe = () => {};
        try {
            if (Object.keys(firebaseConfig).length === 0) {
                throw new Error("Firebase config is missing. Please ensure it's provided.");
            }
            const app = initializeApp(firebaseConfig);
            const db = getFirestore(app);
            const auth = getAuth(app);

            const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                    setView('home'); 
                    setShowLoginSuccess(true);
                    setTimeout(() => setShowLoginSuccess(false), 3000);

                    const publicCollectionPath = `artifacts/${appId}/public/data/bloodBanks`;
                    const q = query(collection(db, publicCollectionPath));
                    
                    unsubscribe = onSnapshot(q, (querySnapshot) => {
                        const banks = [];
                        querySnapshot.forEach((doc) => {
                            banks.push({ id: doc.id, ...doc.data() });
                        });
                        setBloodBanks(banks);

                        if (banks.length === 0) {
                            addInitialData(db, publicCollectionPath);
                        }
                        setLoading(false);
                    }, (err) => {
                        console.error("Firestore snapshot error:", err);
                        setError("Failed to load blood bank data. Please try again later.");
                        setLoading(false);
                    });
                } else {
                    setUserId(null);
                    setLoading(false);
                }
            });

            return () => {
                authUnsubscribe();
                unsubscribe();
            };
        } catch (initError) {
            console.error("Firebase initialization failed:", initError);
            setError("Application initialization failed. Check your configuration.");
            setLoading(false);
        }
    }, []);

    const addInitialData = async (db, collectionPath) => {
        await setDoc(doc(db, collectionPath, "hospital-A"), {
            name: "City General Hospital",
            location: "Mumbai",
            inventory: { "A+": 25, "A-": 12, "B+": 30, "B-": 8, "AB+": 5, "AB-": 3, "O+": 50, "O-": 20 }
        });
        await setDoc(doc(db, collectionPath, "hospital-B"), {
            name: "Community Health Center",
            location: "Delhi",
            inventory: { "A+": 10, "A-": 5, "B+": 15, "B-": 2, "AB+": 2, "AB-": 1, "O+": 25, "O-": 10 }
        });
        await setDoc(doc(db, collectionPath, "hospital-C"), {
            name: "Regional Trauma Center",
            location: "Bangalore",
            inventory: { "A+": 50, "A-": 20, "B+": 40, "B-": 10, "AB+": 8, "AB-": 5, "O+": 80, "O-": 40 }
        });
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        const auth = getAuth();
        try {
            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
            } else {
                await signInAnonymously(auth);
            }
        } catch (err) {
            console.error("Login failed:", err);
            setError("Failed to log in. Please try again.");
        }
    };

    const handleLogout = async () => {
        const auth = getAuth();
        try {
            await signOut(auth);
            setView('login');
        } catch (err) {
            console.error("Logout failed:", err);
        }
    };
    
    const handleDonateSubmit = (e) => {
        e.preventDefault();
        alert('Thank you for your donation! We will contact you shortly.');
        setShowDonateModal(false);
    };

    const handleBloodRequest = async (e) => {
        e.preventDefault();
        const bloodType = e.target.bloodType.value;
        const hospitalName = e.target.hospital.value;
        const amount = parseInt(e.target.amount.value);

        if (!bloodType || !hospitalName || !amount) {
            setRequestStatus({ type: 'error', message: 'Please fill in all fields.' });
            return;
        }
        const bank = bloodBanks.find(b => b.name === hospitalName);
        if (!bank) {
            setRequestStatus({ type: 'error', message: 'Hospital not found.' });
            return;
        }
        const currentAmount = bank.inventory[bloodType];
        if (currentAmount === undefined) {
            setRequestStatus({ type: 'error', message: 'This blood type is not tracked for this hospital.' });
            return;
        }
        if (currentAmount < amount) {
            setRequestStatus({ type: 'error', message: `Not enough ${bloodType} blood available at ${hospitalName}. Only ${currentAmount} units available.` });
            return;
        }
        try {
            const db = getFirestore();
            const publicCollectionPath = `artifacts/${appId}/public/data/bloodBanks`;
            const bankRef = doc(db, publicCollectionPath, bank.id);
            const newInventory = { ...bank.inventory, [bloodType]: currentAmount - amount };
            await updateDoc(bankRef, { inventory: newInventory });
            setRequestStatus({ type: 'success', message: `Successfully requested ${amount} units of ${bloodType} blood from ${hospitalName}. Click here to find the hospital.`, hospital: hospitalName });
            e.target.reset(); 
        } catch (err) {
            console.error("Error updating inventory:", err);
            setRequestStatus({ type: 'error', message: 'Failed to process request. Please try again.' });
        }
    };

    const renderLoginPortal = () => (
        <div className="flex items-center justify-center flex-grow p-4">
            <div className="bg-slate-800 p-8 rounded-xl shadow-xl max-w-sm w-full text-center">
                <h2 className="text-2xl font-bold mb-4 text-indigo-400">Login or Create Account</h2>
                <p className="mb-6 text-slate-400">Enter your details to get started.</p>
                <form className="space-y-4" onSubmit={handleLogin}>
                    <div>
                        <input type="email" placeholder="Email" className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white border-none focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                    </div>
                    <div>
                        <input type="text" placeholder="Full Name" className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white border-none focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                    </div>
                    <button type="submit" className="w-full px-6 py-3 bg-indigo-500 text-white font-bold rounded-full shadow-lg hover:bg-indigo-600 transition-colors">Log In / Create Account</button>
                </form>
            </div>
        </div>
    );

    const renderHomePage = () => (
        <div className="p-8 text-center max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold text-indigo-400 mb-6">Welcome to the Blood Bank System</h2>
            <p className="text-lg mb-4 text-slate-300">
                This is a secure and efficient platform designed to manage and track blood donations and inventory in real-time. Our goal is to connect hospitals with the blood they need, when they need it, ensuring a quick and reliable supply.
            </p>
            <p className="text-lg mb-8 text-slate-300">
                Navigate to the dashboard to view current inventory, or use the request and search features to find specific blood types.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-800 rounded-xl p-6 shadow-xl hover:shadow-2xl transition-shadow duration-300">
                    <h3 className="text-xl font-bold mb-2">Real-time Dashboard</h3>
                    <p className="text-sm text-slate-400">View live inventory levels from all connected hospitals.</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-6 shadow-xl hover:shadow-2xl transition-shadow duration-300">
                    <h3 className="text-xl font-bold mb-2">Request & Track</h3>
                    <p className="text-sm text-slate-400">Easily request blood and track the status of your order.</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-6 shadow-xl hover:shadow-2xl transition-shadow duration-300">
                    <h3 className="text-xl font-bold mb-2">Efficient Search</h3>
                    <p className="text-sm text-slate-400">Quickly find specific blood types available across our network.</p>
                </div>
            </div>
        </div>
    );

    const renderAboutPage = () => (
        <div className="p-8 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-6 text-indigo-400">About Us</h2>
            <div className="bg-slate-800 rounded-xl p-8 shadow-xl">
                <p className="text-lg mb-4 text-slate-300">
                    Our mission is to streamline the process of blood bank management through modern technology. We believe that every unit of blood is precious, and by providing a transparent and efficient system, we can help save lives.
                </p>
                <p className="text-lg mb-4 text-slate-300">
                    This platform was created to demonstrate how a centralized, real-time database can improve communication between blood banks and hospitals. By using Firebase Firestore, we ensure that all data is instantly updated, giving healthcare professionals the most accurate information available.
                </p>
                <p className="text-lg text-slate-300">
                    We are dedicated to building a more resilient and responsive healthcare infrastructure, one feature at a time.
                </p>
            </div>
        </div>
    );
    
    const renderRequestForm = () => (
        <div className="p-8 max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-6 text-indigo-400">Request Blood</h2>
            <form onSubmit={handleBloodRequest} className="bg-slate-800 p-8 rounded-xl shadow-xl space-y-6">
                <div>
                    <label htmlFor="requesterName" className="block text-lg font-medium mb-2">Your Name</label>
                    <input type="text" id="requesterName" name="requesterName" className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white border-none focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="requesterAge" className="block text-lg font-medium mb-2">Age</label>
                        <input type="number" id="requesterAge" name="requesterAge" min="18" className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white border-none focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                    </div>
                    <div>
                        <label htmlFor="requesterGender" className="block text-lg font-medium mb-2">Gender</label>
                        <select id="requesterGender" name="requesterGender" className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white border-none focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
                            <option value="">Select Gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label htmlFor="bloodType" className="block text-lg font-medium mb-2">Blood Type Needed</label>
                    <select id="bloodType" name="bloodType" className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white border-none focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select Blood Type</option>
                        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="hospital" className="block text-lg font-medium mb-2">From Hospital</label>
                    <select id="hospital" name="hospital" className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white border-none focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select Hospital</option>
                        {bloodBanks.map(bank => (
                            <option key={bank.id} value={bank.name}>{bank.name} ({bank.location})</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="amount" className="block text-lg font-medium mb-2">Amount (Units)</label>
                    <input type="number" id="amount" name="amount" min="1" className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white border-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <button type="submit" className="w-full px-6 py-3 bg-indigo-500 text-white font-bold rounded-full shadow-lg hover:bg-indigo-600 transition-colors">Submit Request</button>
            </form>

            {requestStatus && (
                <div className={`mt-6 p-4 rounded-lg text-center ${requestStatus.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                    {requestStatus.message.split('.').map((part, index) => (
                        <span key={index}>
                            {part}
                            {index === 0 && requestStatus.type === 'success' && (
                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(requestStatus.hospital)}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-200">
                                    Click here to find the hospital.
                                </a>
                            )}
                            {index < requestStatus.message.split('.').length - 1 && '.'}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );

    const renderDonateModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-xl p-8 shadow-2xl max-w-sm w-full relative">
                <button onClick={() => setShowDonateModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <h3 className="text-2xl font-bold text-indigo-400 mb-4 text-center">Donate Blood</h3>
                <form onSubmit={handleDonateSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="donorName" className="block text-sm font-medium mb-1">Full Name</label>
                        <input type="text" id="donorName" className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white" required />
                    </div>
                    <div>
                        <label htmlFor="weight" className="block text-sm font-medium mb-1">Weight (kg)</label>
                        <input type="number" id="weight" className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white" required />
                    </div>
                    <div>
                        <label htmlFor="age" className="block text-sm font-medium mb-1">Age</label>
                        <input type="number" id="age" className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white" required />
                    </div>
                    <div>
                        <label htmlFor="medicalIssues" className="block text-sm font-medium mb-1">Any medical issues?</label>
                        <select id="medicalIssues" className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white" required>
                            <option value="no">No</option>
                            <option value="yes">Yes</option>
                        </select>
                    </div>
                    <button type="submit" className="w-full px-6 py-3 bg-indigo-500 text-white font-bold rounded-full shadow-lg hover:bg-indigo-600 transition-colors">Submit Donation</button>
                </form>
            </div>
        </div>
    );

    const renderContactPage = () => (
        <div className="p-8 max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-6 text-indigo-400">Contact Us</h2>
            <div className="bg-slate-800 p-8 rounded-xl shadow-xl space-y-6">
                <form className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-lg font-medium mb-2">Name</label>
                        <input type="text" id="name" className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white border-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label htmlFor="email" className="block text-lg font-medium mb-2">Email</label>
                        <input type="email" id="email" className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white border-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label htmlFor="message" className="block text-lg font-medium mb-2">Message</label>
                        <textarea id="message" rows="4" className="w-full px-4 py-3 rounded-lg bg-slate-700 text-white border-none focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
                    </div>
                    <button type="submit" className="w-full px-6 py-3 bg-indigo-500 text-white font-bold rounded-full shadow-lg hover:bg-indigo-600 transition-colors">Send Message</button>
                </form>
                <div className="pt-4 border-t border-slate-700">
                    <p className="text-lg font-bold mb-2">Our Information:</p>
                    <p className="text-slate-300"><span className="font-semibold">Phone:</span> +91 98765 43210</p>
                    <p className="text-slate-300"><span className="font-semibold">Email:</span> contact.ind@bloodbank.dev</p>
                    <p className="text-slate-300"><span className="font-semibold">Address:</span> 1A, J.B.S Haldane Ave, Salt Lake, Kolkata, West Bengal 700064, India</p>
                </div>
            </div>
        </div>
    );

    const renderContent = () => {
        if (!userId) {
            return renderLoginPortal();
        }

        switch (view) {
            case 'home':
                return renderHomePage();
            case 'about':
                return renderAboutPage();
            case 'request':
                return renderRequestForm();
            case 'contact':
                return renderContactPage();
            default:
                return renderHomePage();
        }
    };
    
    const renderModal = () => {
      if (showDonateModal) {
        return renderDonateModal();
      }
      return null;
    }

    const renderLoginSuccessModal = () => {
        if (!showLoginSuccess) {
            return null;
        }

        return (
            <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[100]">
                <div className="bg-green-600 text-white font-bold py-4 px-8 rounded-full shadow-lg text-center animate-fade-in-up">
                    Successfully done!
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900 text-slate-100">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
                <p className="ml-4 text-xl">Loading...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900 text-red-500 text-center p-4">
                <p>Error: {error}</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-900 text-white min-h-screen flex flex-col">
            <style>
                {`
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateY(20px); }
                    10% { opacity: 1; transform: translateY(0); }
                    90% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-20px); }
                }

                .animate-fade-in-up {
                    animation: fadeInOut 3s forwards;
                }
                `}
            </style>
            <header className="bg-gray-800 p-4 shadow-lg sticky top-0 z-50">
                <nav className="container mx-auto flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
                    <h1 className="text-2xl font-bold text-indigo-400">Blood Bank System</h1>
                    {userId ? (
                        <div className="flex flex-wrap justify-center space-x-2 sm:space-x-4">
                            <button onClick={() => setView('home')} className={`px-4 py-2 rounded-lg transition-colors ${view === 'home' ? 'bg-indigo-500' : 'hover:bg-indigo-500'}`}>Home</button>
                            <button onClick={() => setView('about')} className={`px-4 py-2 rounded-lg transition-colors ${view === 'about' ? 'bg-indigo-500' : 'hover:bg-indigo-500'}`}>About Us</button>
                            <button onClick={() => setView('request')} className={`px-4 py-2 rounded-lg transition-colors ${view === 'request' ? 'bg-indigo-500' : 'hover:bg-indigo-500'}`}>Request Blood</button>
                            <button onClick={() => setShowDonateModal(true)} className="px-4 py-2 rounded-lg transition-colors hover:bg-indigo-500">Donate</button>
                            <button onClick={() => setView('contact')} className={`px-4 py-2 rounded-lg transition-colors ${view === 'contact' ? 'bg-indigo-500' : 'hover:bg-indigo-500'}`}>Contact Us</button>
                            <button onClick={handleLogout} className="mt-4 sm:mt-0 px-4 py-2 bg-red-600 text-white font-bold rounded-lg shadow-lg hover:bg-red-700 transition-colors">Log Out</button>
                        </div>
                    ) : (
                        <div className="flex space-x-4">
                            <button onClick={handleLogin} className="px-4 py-2 bg-indigo-500 text-white font-bold rounded-lg shadow-lg hover:bg-indigo-600 transition-colors">Log In</button>
                        </div>
                    )}
                </nav>
            </header>

            <main className="container mx-auto p-4 flex-grow">
                {renderContent()}
            </main>

            <footer className="py-4 text-center text-sm text-slate-400">
                <p>&copy; 2024 Blood Bank System. All rights reserved.</p>
                {userId && (
                    <p className="mt-2">Logged in as: <span className="font-mono text-xs break-all">{userId}</span></p>
                )}
            </footer>
            {renderModal()}
            {renderLoginSuccessModal()}
        </div>
    );
};

export default BloodBankManagementSystem;
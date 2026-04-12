import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
import os

# Load .env variables
load_dotenv()

# Initialize Firebase Admin
if not firebase_admin._apps:
    cred = credentials.Certificate(
        "/Users/vishaldhariwal/Code/Projects/ExamSyncAi/Backend/firebase_key.json"
    )
    firebase_admin.initialize_app(cred)

# Firestore database
db = firestore.client()
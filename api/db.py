import os
import sqlite3
from urllib.parse import urlparse

DATABASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "recoup.db")

def get_db_url():
    # Attempt to load .env variables manually in case load_dotenv wasn't run yet
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))
    return os.environ.get("DATABASE_URL", "sqlite:///recoup.db")

def get_db_connection():
    db_url = get_db_url()
    if db_url.startswith("postgres://") or db_url.startswith("postgresql://"):
        try:
            import psycopg2
            # Parse PostgreSQL URL
            url = urlparse(db_url)
            conn = psycopg2.connect(
                database=url.path[1:],
                user=url.username,
                password=url.password,
                host=url.hostname,
                port=url.port or 5432,
                sslmode="require"
            )
            return conn
        except ImportError:
            print("Warning: psycopg2-binary not installed. Falling back to local SQLite.")
            conn = sqlite3.connect(DATABASE_PATH)
            conn.row_factory = sqlite3.Row
            return conn
        except Exception as e:
            print(f"\n[Database Warning] PostgreSQL connection to Neon Cloud failed: {e}")
            print("Falling back to local SQLite database (recoup.db) for this session.\n")
            conn = sqlite3.connect(DATABASE_PATH)
            conn.row_factory = sqlite3.Row
            return conn
    else:
        # SQLite fallback
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        return conn

class DBCursorWrapper:
    def __init__(self, cursor, is_postgres):
        self.cursor = cursor
        self.is_postgres = is_postgres
        
    def execute(self, query, vars=None):
        if self.is_postgres and isinstance(query, str):
            # Replace SQLite '?' placeholder with PostgreSQL '%s'
            query = query.replace("?", "%s")
        if vars is None:
            return self.cursor.execute(query)
        return self.cursor.execute(query, vars)
        
    def __getattr__(self, name):
        return getattr(self.cursor, name)

def get_db_cursor(conn):
    """
    Returns a wrapped cursor that translates SQL parameters and yields dictionary-like 
    rows for compatibility across both SQLite and PostgreSQL.
    """
    is_postgres = (type(conn).__name__ == "connection")
    if is_postgres:
        from psycopg2.extras import DictCursor
        raw_cursor = conn.cursor(cursor_factory=DictCursor)
        return DBCursorWrapper(raw_cursor, is_postgres=True)
    else:
        raw_cursor = conn.cursor()
        return DBCursorWrapper(raw_cursor, is_postgres=False)

def init_db():
    conn = get_db_connection()
    is_postgres = (type(conn).__name__ == "connection")
    
    # Postgres uses SERIAL for auto-incrementing primary keys
    auto_inc = "SERIAL PRIMARY KEY" if is_postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"
    
    cursor = get_db_cursor(conn)
    
    # Create transactions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        razorpay_payment_id TEXT,
        amount REAL,
        currency TEXT,
        status TEXT,
        customer_name TEXT,
        customer_email TEXT,
        customer_phone TEXT,
        raw_reason TEXT,
        normalized_reason TEXT,
        customer_segment TEXT,
        attempt_count INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create audit_log table
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS audit_log (
        id {auto_inc},
        txn_id TEXT,
        stage TEXT,
        actor TEXT,
        reason TEXT,
        action TEXT,
        outcome TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create whatsapp_outbox table
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS whatsapp_outbox (
        id {auto_inc},
        txn_id TEXT,
        customer_phone TEXT,
        message_body TEXT,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create human_queue table
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS human_queue (
        id {auto_inc},
        txn_id TEXT,
        reason TEXT,
        escalated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending'
    )
    """)
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database schema successfully configured/initialized.")

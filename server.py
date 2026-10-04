#!/usr/bin/env python3
"""Set UP — social platform for the film industry.

Zero dependencies: Python 3 standard library + SQLite.
    python3 server.py            # http://127.0.0.1:8000
    python3 server.py --seed     # also fill an empty database with demo people
"""
import base64
import binascii
import hashlib
import hmac
import http.server
import json
import mimetypes
import os
import re
import secrets
import socketserver
import sqlite3
import sys
from datetime import datetime, timezone
from http import cookies
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(ROOT, "static")
UPLOADS = os.path.join(ROOT, "uploads")
DB_PATH = os.path.join(ROOT, "setup.db")
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8000"))
MAX_BODY = 8 * 1024 * 1024
MAX_IMAGE = 5 * 1024 * 1024
SESSION_DAYS = 30

ROLES = ["Actor", "Director", "Producer", "Cinematographer", "Editor", "Writer", "Sound", "Production Designer",
         "Costume & Makeup", "VFX & Animation", "Crew", "Student", "Other"]
CATEGORIES = ["Acting", "Crew", "Voice", "Extras", "Other"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, pw_hash TEXT NOT NULL, pw_salt TEXT NOT NULL,
  name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'Other', headline TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '', skills TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '', created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS posts(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, body TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS likes(post_id INTEGER NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY(post_id, user_id));
CREATE TABLE IF NOT EXISTS comments(
  id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL, user_id INTEGER NOT NULL, body TEXT NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS follows(follower_id INTEGER NOT NULL, followee_id INTEGER NOT NULL,
  PRIMARY KEY(follower_id, followee_id));
CREATE TABLE IF NOT EXISTS connections(
  id INTEGER PRIMARY KEY, from_id INTEGER NOT NULL, to_id INTEGER NOT NULL, status TEXT NOT NULL,
  created TEXT NOT NULL, UNIQUE(from_id, to_id));
CREATE TABLE IF NOT EXISTS castings(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL,
  production TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', pay TEXT NOT NULL DEFAULT '',
  deadline TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS applications(
  id INTEGER PRIMARY KEY, casting_id INTEGER NOT NULL, user_id INTEGER NOT NULL, message TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL, UNIQUE(casting_id, user_id));
CREATE TABLE IF NOT EXISTS meetups(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, title TEXT NOT NULL, city TEXT NOT NULL DEFAULT '',
  venue TEXT NOT NULL DEFAULT '', starts TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rsvps(meetup_id INTEGER NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY(meetup_id, user_id));
CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY, from_id INTEGER NOT NULL, to_id INTEGER NOT NULL, body TEXT NOT NULL,
  created TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, kind TEXT NOT NULL, actor_id INTEGER NOT NULL,
  ref INTEGER NOT NULL DEFAULT 0, label TEXT NOT NULL DEFAULT '', created TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created);
CREATE INDEX IF NOT EXISTS idx_msgs ON messages(from_id, to_id);
CREATE INDEX IF NOT EXISTS idx_notif ON notifications(user_id, read);
"""


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def connect():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    return con


def init_db():
    os.makedirs(UPLOADS, exist_ok=True)
    con = connect()
    con.execute("PRAGMA journal_mode=WAL")
    con.executescript(SCHEMA)
    con.commit()
    con.close()


def hash_pw(password, salt=None):
    salt = salt or secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000)
    return h.hex(), salt


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status, self.message = status, message


def need(cond, message, status=400):
    if not cond:
        raise ApiError(status, message)


def clean(value, limit, required=False, label="Field"):
    value = (value or "").strip() if isinstance(value, str) else ""
    need(not required or value, f"{label} is required")
    need(len(value) <= limit, f"{label} is too long (max {limit})")
    return value


def user_json(row):
    return {k: row[k] for k in ("id", "name", "role", "headline", "city", "avatar")}


def notify(con, user_id, kind, actor_id, ref=0, label=""):
    if user_id == actor_id:
        return
    con.execute("INSERT INTO notifications(user_id,kind,actor_id,ref,label,created) VALUES(?,?,?,?,?,?)",
                (user_id, kind, actor_id, ref, label, now()))


def connection_state(con, me, other):
    """none | connected | sent | received"""
    if me == other:
        return "self"
    row = con.execute("SELECT from_id,status FROM connections WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?)",
                      (me, other, other, me)).fetchone()
    if not row:
        return "none"
    if row["status"] == "accepted":
        return "connected"
    return "sent" if row["from_id"] == me else "received"


def is_connected(con, a, b):
    return connection_state(con, a, b) == "connected"


# ---------------------------------------------------------------- handlers
class Api:
    def __init__(self, con, user, body, query):
        self.con, self.user, self.body, self.query = con, user, body, query

    @property
    def uid(self):
        need(self.user, "Please log in", 401)
        return self.user["id"]

    def q(self, name, default=""):
        return self.query.get(name, [default])[0].strip()

    # ---- auth
    def signup(self):
        b = self.body
        name = clean(b.get("name"), 80, True, "Name")
        email = clean(b.get("email"), 160, True, "Email").lower()
        need(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email), "Enter a valid email")
        pw = b.get("password") or ""
        need(isinstance(pw, str) and 8 <= len(pw) <= 200, "Password must be at least 8 characters")
        role = b.get("role") if b.get("role") in ROLES else "Other"
        city = clean(b.get("city"), 80)
        need(not self.con.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone(),
             "That email is already registered", 409)
        h, salt = hash_pw(pw)
        cur = self.con.execute(
            "INSERT INTO users(email,pw_hash,pw_salt,name,role,city,headline,created) VALUES(?,?,?,?,?,?,?,?)",
            (email, h, salt, name, role, city, role, now()))
        return {"_login": cur.lastrowid}

    def login(self):
        email = clean(self.body.get("email"), 160).lower()
        pw = self.body.get("password") or ""
        row = self.con.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        ok = False
        if row and isinstance(pw, str):
            h, _ = hash_pw(pw, row["pw_salt"])
            ok = hmac.compare_digest(h, row["pw_hash"])
        need(ok, "Wrong email or password", 401)
        return {"_login": row["id"]}

    def logout(self):
        return {"_logout": True}

    def me(self):
        if not self.user:
            return {"user": None, "roles": ROLES, "categories": CATEGORIES}
        u = dict(self.user)
        u.pop("pw_hash"), u.pop("pw_salt")
        c = self.con
        u["unread_notifications"] = c.execute(
            "SELECT COUNT(*) FROM notifications WHERE user_id=? AND read=0", (u["id"],)).fetchone()[0]
        u["unread_messages"] = c.execute(
            "SELECT COUNT(*) FROM messages WHERE to_id=? AND read=0", (u["id"],)).fetchone()[0]
        return {"user": u, "roles": ROLES, "categories": CATEGORIES}

    def update_me(self):
        b = self.body
        role = b.get("role") if b.get("role") in ROLES else self.user["role"]
        avatar = b.get("avatar", self.user["avatar"])
        need(avatar == "" or (isinstance(avatar, str) and re.fullmatch(r"/uploads/[a-f0-9]{32}\.(png|jpg|gif|webp)", avatar)),
             "Invalid avatar")
        self.con.execute(
            "UPDATE users SET name=?,role=?,headline=?,city=?,bio=?,skills=?,avatar=? WHERE id=?",
            (clean(b.get("name"), 80, True, "Name"), role, clean(b.get("headline"), 120), clean(b.get("city"), 80),
             clean(b.get("bio"), 1500), clean(b.get("skills"), 300), avatar, self.uid))
        return {"ok": True}

    # ---- uploads
    def upload(self):
        self.uid
        data = self.body.get("data") or ""
        need(isinstance(data, str), "Bad upload")
        m = re.fullmatch(r"data:image/[a-z+.-]+;base64,([A-Za-z0-9+/=\s]+)", data)
        need(m, "Upload an image")
        try:
            raw = base64.b64decode(m.group(1), validate=False)
        except (binascii.Error, ValueError):
            raise ApiError(400, "Bad image data")
        need(len(raw) <= MAX_IMAGE, "Image too large (max 5 MB)")
        if raw.startswith(b"\x89PNG\r\n\x1a\n"):
            ext = "png"
        elif raw.startswith(b"\xff\xd8\xff"):
            ext = "jpg"
        elif raw[:6] in (b"GIF87a", b"GIF89a"):
            ext = "gif"
        elif raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
            ext = "webp"
        else:
            raise ApiError(400, "Only PNG, JPG, GIF or WebP images")
        name = f"{secrets.token_hex(16)}.{ext}"
        with open(os.path.join(UPLOADS, name), "wb") as f:
            f.write(raw)
        return {"url": f"/uploads/{name}"}

    # ---- posts
    def _posts(self, where, args, limit=50):
        rows = self.con.execute(f"""
          SELECT p.*, u.name, u.role, u.headline, u.city, u.avatar,
            (SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) AS likes,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS comments,
            (SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id AND l.user_id=?) AS liked
          FROM posts p JOIN users u ON u.id=p.user_id WHERE {where} ORDER BY p.created DESC, p.id DESC LIMIT ?""",
                                 [self.user["id"] if self.user else 0] + args + [limit]).fetchall()
        return [{"id": r["id"], "body": r["body"], "image": r["image"], "created": r["created"], "likes": r["likes"],
                 "comments": r["comments"], "liked": bool(r["liked"]),
                 "user": {"id": r["user_id"], "name": r["name"], "role": r["role"], "headline": r["headline"],
                          "city": r["city"], "avatar": r["avatar"]}} for r in rows]

    def feed(self):
        if self.q("scope") == "network" and self.user:
            uid = self.uid
            where = """(p.user_id=? OR p.user_id IN (SELECT followee_id FROM follows WHERE follower_id=?)
              OR p.user_id IN (SELECT CASE WHEN from_id=? THEN to_id ELSE from_id END FROM connections
                               WHERE status='accepted' AND (from_id=? OR to_id=?)))"""
            return {"posts": self._posts(where, [uid] * 5)}
        return {"posts": self._posts("1=1", [])}

    def create_post(self):
        uid = self.uid
        body = clean(self.body.get("body"), 3000)
        image = self.body.get("image") or ""
        need(image == "" or re.fullmatch(r"/uploads/[a-f0-9]{32}\.(png|jpg|gif|webp)", image), "Invalid image")
        need(body or image, "Write something or add an image")
        cur = self.con.execute("INSERT INTO posts(user_id,body,image,created) VALUES(?,?,?,?)", (uid, body, image, now()))
        return {"id": cur.lastrowid}

    def delete_post(self, pid):
        if self.con.execute("DELETE FROM posts WHERE id=? AND user_id=?", (pid, self.uid)).rowcount:
            self.con.execute("DELETE FROM likes WHERE post_id=?", (pid,))
            self.con.execute("DELETE FROM comments WHERE post_id=?", (pid,))
        return {"ok": True}

    def like(self, pid):
        uid = self.uid
        post = self.con.execute("SELECT user_id FROM posts WHERE id=?", (pid,)).fetchone()
        need(post, "Post not found", 404)
        if self.con.execute("DELETE FROM likes WHERE post_id=? AND user_id=?", (pid, uid)).rowcount == 0:
            self.con.execute("INSERT INTO likes VALUES(?,?)", (pid, uid))
            notify(self.con, post["user_id"], "like", uid, pid)
        n = self.con.execute("SELECT COUNT(*) FROM likes WHERE post_id=?", (pid,)).fetchone()[0]
        liked = bool(self.con.execute("SELECT 1 FROM likes WHERE post_id=? AND user_id=?", (pid, uid)).fetchone())
        return {"likes": n, "liked": liked}

    def get_comments(self, pid):
        rows = self.con.execute("""SELECT c.id,c.body,c.created,u.id uid,u.name,u.role,u.headline,u.city,u.avatar
            FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.id""", (pid,)).fetchall()
        return {"comments": [{"id": r["id"], "body": r["body"], "created": r["created"],
                              "user": {"id": r["uid"], "name": r["name"], "role": r["role"], "headline": r["headline"],
                                       "city": r["city"], "avatar": r["avatar"]}} for r in rows]}

    def add_comment(self, pid):
        uid = self.uid
        post = self.con.execute("SELECT user_id FROM posts WHERE id=?", (pid,)).fetchone()
        need(post, "Post not found", 404)
        body = clean(self.body.get("body"), 1000, True, "Comment")
        self.con.execute("INSERT INTO comments(post_id,user_id,body,created) VALUES(?,?,?,?)", (pid, uid, body, now()))
        notify(self.con, post["user_id"], "comment", uid, pid)
        return self.get_comments(pid)

    # ---- people / network
    def people(self):
        q, role, city = self.q("q"), self.q("role"), self.q("city")
        where, args = ["1=1"], []
        if self.user:
            where.append("u.id != ?")
            args.append(self.user["id"])
        if q:
            where.append("(u.name LIKE ? OR u.headline LIKE ? OR u.skills LIKE ?)")
            args += [f"%{q}%"] * 3
        if role in ROLES:
            where.append("u.role=?")
            args.append(role)
        if city:
            where.append("u.city LIKE ?")
            args.append(f"%{city}%")
        rows = self.con.execute(f"SELECT * FROM users u WHERE {' AND '.join(where)} ORDER BY u.id DESC LIMIT 60",
                                args).fetchall()
        out = []
        for r in rows:
            j = user_json(r)
            j["state"] = connection_state(self.con, self.user["id"], r["id"]) if self.user else "none"
            out.append(j)
        return {"people": out}

    def profile(self, uid):
        r = self.con.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        need(r, "Person not found", 404)
        c = self.con
        me = self.user["id"] if self.user else 0
        j = user_json(r)
        j.update(bio=r["bio"], skills=r["skills"], created=r["created"])
        j["followers"] = c.execute("SELECT COUNT(*) FROM follows WHERE followee_id=?", (uid,)).fetchone()[0]
        j["connections"] = c.execute(
            "SELECT COUNT(*) FROM connections WHERE status='accepted' AND (from_id=? OR to_id=?)", (uid, uid)).fetchone()[0]
        j["state"] = connection_state(c, me, uid) if me else "none"
        j["following"] = bool(me and c.execute("SELECT 1 FROM follows WHERE follower_id=? AND followee_id=?",
                                               (me, uid)).fetchone())
        j["posts"] = self._posts("p.user_id=?", [uid])
        j["castings"] = [self._casting_row(x) for x in c.execute(
            "SELECT c.*, u.name uname FROM castings c JOIN users u ON u.id=c.user_id WHERE c.user_id=? ORDER BY c.id DESC",
            (uid,)).fetchall()]
        return j

    def follow(self, uid):
        me = self.uid
        need(uid != me, "You can't follow yourself")
        need(self.con.execute("SELECT 1 FROM users WHERE id=?", (uid,)).fetchone(), "Person not found", 404)
        if self.con.execute("DELETE FROM follows WHERE follower_id=? AND followee_id=?", (me, uid)).rowcount == 0:
            self.con.execute("INSERT INTO follows VALUES(?,?)", (me, uid))
            notify(self.con, uid, "follow", me)
            return {"following": True}
        return {"following": False}

    def connect_to(self, uid):
        me = self.uid
        need(uid != me, "You can't connect with yourself")
        need(self.con.execute("SELECT 1 FROM users WHERE id=?", (uid,)).fetchone(), "Person not found", 404)
        state = connection_state(self.con, me, uid)
        if state == "none":
            self.con.execute("INSERT INTO connections(from_id,to_id,status,created) VALUES(?,?,?,?)",
                             (me, uid, "pending", now()))
            notify(self.con, uid, "connect_request", me)
            # connecting also follows, like on Instagram
            self.con.execute("INSERT OR IGNORE INTO follows VALUES(?,?)", (me, uid))
            return {"state": "sent"}
        if state == "received":
            return self.accept(uid)
        return {"state": state}

    def accept(self, uid):
        me = self.uid
        cur = self.con.execute("UPDATE connections SET status='accepted' WHERE from_id=? AND to_id=? AND status='pending'",
                               (uid, me))
        need(cur.rowcount, "No pending request", 404)
        notify(self.con, uid, "connect_accept", me)
        return {"state": "connected"}

    def decline(self, uid):
        me = self.uid
        self.con.execute("DELETE FROM connections WHERE status='pending' AND from_id=? AND to_id=?", (uid, me))
        return {"state": "none"}

    def disconnect(self, uid):
        me = self.uid
        self.con.execute("DELETE FROM connections WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?)",
                         (me, uid, uid, me))
        return {"state": "none"}

    def requests(self):
        rows = self.con.execute("""SELECT u.* FROM connections c JOIN users u ON u.id=c.from_id
            WHERE c.to_id=? AND c.status='pending' ORDER BY c.id DESC""", (self.uid,)).fetchall()
        return {"requests": [user_json(r) for r in rows]}

    def my_network(self):
        uid = self.uid
        rows = self.con.execute("""SELECT u.* FROM connections c JOIN users u
            ON u.id = CASE WHEN c.from_id=? THEN c.to_id ELSE c.from_id END
            WHERE c.status='accepted' AND (c.from_id=? OR c.to_id=?) ORDER BY u.name""", (uid, uid, uid)).fetchall()
        return {"connections": [user_json(r) for r in rows]}

    def suggestions(self):
        """People in your city or your craft you aren't linked with yet."""
        uid = self.uid
        me = self.user
        rows = self.con.execute("""SELECT * FROM users u WHERE u.id != ?
            AND NOT EXISTS(SELECT 1 FROM connections c WHERE (c.from_id=u.id AND c.to_id=?) OR (c.from_id=? AND c.to_id=u.id))
            ORDER BY (u.city != '' AND LOWER(u.city)=LOWER(?)) DESC, (u.role=?) DESC, u.id DESC LIMIT 8""",
                                (uid, uid, uid, me["city"], me["role"])).fetchall()
        return {"people": [user_json(r) for r in rows]}

    # ---- castings
    def _casting_row(self, r):
        return {"id": r["id"], "title": r["title"], "category": r["category"], "production": r["production"],
                "city": r["city"], "pay": r["pay"], "deadline": r["deadline"], "description": r["description"],
                "created": r["created"], "user_id": r["user_id"], "poster": r["uname"]}

    def castings(self):
        q, cat, city = self.q("q"), self.q("category"), self.q("city")
        where, args = ["1=1"], []
        if cat in CATEGORIES:
            where.append("c.category=?")
            args.append(cat)
        if city:
            where.append("c.city LIKE ?")
            args.append(f"%{city}%")
        if q:
            where.append("(c.title LIKE ? OR c.production LIKE ? OR c.description LIKE ?)")
            args += [f"%{q}%"] * 3
        rows = self.con.execute(f"""SELECT c.*, u.name uname,
            (SELECT COUNT(*) FROM applications a WHERE a.casting_id=c.id) AS applicants,
            (SELECT COUNT(*) FROM applications a WHERE a.casting_id=c.id AND a.user_id=?) AS applied
            FROM castings c JOIN users u ON u.id=c.user_id WHERE {' AND '.join(where)}
            ORDER BY c.id DESC LIMIT 100""", [self.user["id"] if self.user else 0] + args).fetchall()
        out = []
        for r in rows:
            j = self._casting_row(r)
            j.update(applicants=r["applicants"], applied=bool(r["applied"]))
            out.append(j)
        return {"castings": out}

    def casting(self, cid):
        r = self.con.execute("SELECT c.*, u.name uname FROM castings c JOIN users u ON u.id=c.user_id WHERE c.id=?",
                             (cid,)).fetchone()
        need(r, "Casting not found", 404)
        j = self._casting_row(r)
        me = self.user["id"] if self.user else 0
        j["applied"] = bool(me and self.con.execute("SELECT 1 FROM applications WHERE casting_id=? AND user_id=?",
                                                    (cid, me)).fetchone())
        if me == r["user_id"]:
            rows = self.con.execute("""SELECT a.message, a.created, u.* FROM applications a JOIN users u ON u.id=a.user_id
                WHERE a.casting_id=? ORDER BY a.id DESC""", (cid,)).fetchall()
            j["applications"] = [dict(user_json(x), message=x["message"], applied_at=x["created"]) for x in rows]
        return j

    def create_casting(self):
        uid = self.uid
        b = self.body
        cat = b.get("category") if b.get("category") in CATEGORIES else "Other"
        cur = self.con.execute(
            "INSERT INTO castings(user_id,title,category,production,city,pay,deadline,description,created) VALUES(?,?,?,?,?,?,?,?,?)",
            (uid, clean(b.get("title"), 120, True, "Title"), cat, clean(b.get("production"), 120),
             clean(b.get("city"), 80), clean(b.get("pay"), 80), clean(b.get("deadline"), 40),
             clean(b.get("description"), 4000), now()))
        return {"id": cur.lastrowid}

    def apply(self, cid):
        uid = self.uid
        c = self.con.execute("SELECT * FROM castings WHERE id=?", (cid,)).fetchone()
        need(c, "Casting not found", 404)
        need(c["user_id"] != uid, "That's your own casting")
        need(not self.con.execute("SELECT 1 FROM applications WHERE casting_id=? AND user_id=?", (cid, uid)).fetchone(),
             "You already applied", 409)
        self.con.execute("INSERT INTO applications(casting_id,user_id,message,created) VALUES(?,?,?,?)",
                         (cid, uid, clean(self.body.get("message"), 1500), now()))
        notify(self.con, c["user_id"], "application", uid, cid, c["title"])
        return {"ok": True}

    def delete_casting(self, cid):
        uid = self.uid
        if self.con.execute("DELETE FROM castings WHERE id=? AND user_id=?", (cid, uid)).rowcount:
            self.con.execute("DELETE FROM applications WHERE casting_id=?", (cid,))
        return {"ok": True}

    def my_applications(self):
        rows = self.con.execute("""SELECT c.*, u.name uname, a.created applied_at FROM applications a
            JOIN castings c ON c.id=a.casting_id JOIN users u ON u.id=c.user_id
            WHERE a.user_id=? ORDER BY a.id DESC""", (self.uid,)).fetchall()
        return {"castings": [dict(self._casting_row(r), applied=True, applied_at=r["applied_at"]) for r in rows]}

    # ---- meetups
    def meetups(self):
        me = self.user["id"] if self.user else 0
        city = self.q("city")
        where, args = ["m.starts >= ?"], [now()[:10]]
        if self.q("mine") and me:
            where = ["(m.user_id=? OR EXISTS(SELECT 1 FROM rsvps r WHERE r.meetup_id=m.id AND r.user_id=?))"]
            args = [me, me]
        if city:
            where.append("m.city LIKE ?")
            args.append(f"%{city}%")
        rows = self.con.execute(f"""SELECT m.*, u.name host,
            (SELECT COUNT(*) FROM rsvps r WHERE r.meetup_id=m.id) AS going,
            (SELECT COUNT(*) FROM rsvps r WHERE r.meetup_id=m.id AND r.user_id=?) AS joined
            FROM meetups m JOIN users u ON u.id=m.user_id WHERE {' AND '.join(where)}
            ORDER BY m.starts LIMIT 100""", [me] + args).fetchall()
        return {"meetups": [{"id": r["id"], "title": r["title"], "city": r["city"], "venue": r["venue"],
                             "starts": r["starts"], "description": r["description"], "host": r["host"],
                             "host_id": r["user_id"], "going": r["going"], "joined": bool(r["joined"])} for r in rows]}

    def create_meetup(self):
        uid = self.uid
        b = self.body
        starts = clean(b.get("starts"), 16, True, "Date and time")
        need(re.fullmatch(r"\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?", starts), "Enter a valid date")
        cur = self.con.execute(
            "INSERT INTO meetups(user_id,title,city,venue,starts,description,created) VALUES(?,?,?,?,?,?,?)",
            (uid, clean(b.get("title"), 120, True, "Title"), clean(b.get("city"), 80), clean(b.get("venue"), 120),
             starts, clean(b.get("description"), 2000), now()))
        self.con.execute("INSERT INTO rsvps VALUES(?,?)", (cur.lastrowid, uid))
        return {"id": cur.lastrowid}

    def rsvp(self, mid):
        uid = self.uid
        m = self.con.execute("SELECT user_id,title FROM meetups WHERE id=?", (mid,)).fetchone()
        need(m, "Meetup not found", 404)
        if self.con.execute("DELETE FROM rsvps WHERE meetup_id=? AND user_id=?", (mid, uid)).rowcount == 0:
            self.con.execute("INSERT INTO rsvps VALUES(?,?)", (mid, uid))
            notify(self.con, m["user_id"], "rsvp", uid, mid, m["title"])
            return {"joined": True}
        return {"joined": False}

    def delete_meetup(self, mid):
        uid = self.uid
        if self.con.execute("DELETE FROM meetups WHERE id=? AND user_id=?", (mid, uid)).rowcount:
            self.con.execute("DELETE FROM rsvps WHERE meetup_id=?", (mid,))
        return {"ok": True}

    # ---- notifications
    def notifications(self):
        rows = self.con.execute("""SELECT n.*, u.name, u.role, u.headline, u.city, u.avatar FROM notifications n
            JOIN users u ON u.id=n.actor_id WHERE n.user_id=? ORDER BY n.id DESC LIMIT 60""", (self.uid,)).fetchall()
        return {"notifications": [{"id": r["id"], "kind": r["kind"], "ref": r["ref"], "label": r["label"],
                                   "created": r["created"], "read": bool(r["read"]),
                                   "actor": {"id": r["actor_id"], "name": r["name"], "role": r["role"],
                                             "headline": r["headline"], "city": r["city"], "avatar": r["avatar"]}}
                                  for r in rows]}

    def read_notifications(self):
        self.con.execute("UPDATE notifications SET read=1 WHERE user_id=?", (self.uid,))
        return {"ok": True}

    # ---- messages (only between connections)
    def conversations(self):
        uid = self.uid
        rows = self.con.execute("""SELECT u.*, m.body, m.created, m.from_id,
              (SELECT COUNT(*) FROM messages x WHERE x.from_id=u.id AND x.to_id=? AND x.read=0) AS unread
            FROM messages m JOIN users u ON u.id = CASE WHEN m.from_id=? THEN m.to_id ELSE m.from_id END
            WHERE m.id IN (SELECT MAX(id) FROM messages WHERE from_id=? OR to_id=?
                           GROUP BY CASE WHEN from_id=? THEN to_id ELSE from_id END)
            ORDER BY m.id DESC""", (uid,) * 5).fetchall()
        return {"conversations": [{"user": user_json(r), "last": r["body"], "created": r["created"],
                                   "mine": r["from_id"] == uid, "unread": r["unread"]} for r in rows]}

    def thread(self, other):
        uid = self.uid
        u = self.con.execute("SELECT * FROM users WHERE id=?", (other,)).fetchone()
        need(u, "Person not found", 404)
        self.con.execute("UPDATE messages SET read=1 WHERE from_id=? AND to_id=?", (other, uid))
        rows = self.con.execute("""SELECT id,from_id,body,created FROM messages
            WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?) ORDER BY id DESC LIMIT 200""",
                                (uid, other, other, uid)).fetchall()[::-1]
        return {"user": user_json(u), "can_message": is_connected(self.con, uid, other),
                "messages": [{"id": r["id"], "mine": r["from_id"] == uid, "body": r["body"], "created": r["created"]}
                             for r in rows]}

    def send_message(self, other):
        uid = self.uid
        need(other != uid, "You can't message yourself")
        need(is_connected(self.con, uid, other), "Connect with this person first to send messages", 403)
        body = clean(self.body.get("body"), 2000, True, "Message")
        self.con.execute("INSERT INTO messages(from_id,to_id,body,created) VALUES(?,?,?,?)", (uid, other, body, now()))
        return self.thread(other)


ROUTES = [  # (method, regex, handler name)
    ("POST", r"/api/signup", "signup"), ("POST", r"/api/login", "login"), ("POST", r"/api/logout", "logout"),
    ("GET", r"/api/me", "me"), ("POST", r"/api/me", "update_me"), ("POST", r"/api/upload", "upload"),
    ("GET", r"/api/feed", "feed"), ("POST", r"/api/posts", "create_post"),
    ("POST", r"/api/posts/(\d+)/delete", "delete_post"), ("POST", r"/api/posts/(\d+)/like", "like"),
    ("GET", r"/api/posts/(\d+)/comments", "get_comments"), ("POST", r"/api/posts/(\d+)/comments", "add_comment"),
    ("GET", r"/api/people", "people"), ("GET", r"/api/users/(\d+)", "profile"),
    ("POST", r"/api/users/(\d+)/follow", "follow"), ("POST", r"/api/users/(\d+)/connect", "connect_to"),
    ("POST", r"/api/users/(\d+)/accept", "accept"), ("POST", r"/api/users/(\d+)/decline", "decline"),
    ("POST", r"/api/users/(\d+)/disconnect", "disconnect"),
    ("GET", r"/api/requests", "requests"), ("GET", r"/api/network", "my_network"),
    ("GET", r"/api/suggestions", "suggestions"),
    ("GET", r"/api/castings", "castings"), ("POST", r"/api/castings", "create_casting"),
    ("GET", r"/api/castings/(\d+)", "casting"), ("POST", r"/api/castings/(\d+)/apply", "apply"),
    ("POST", r"/api/castings/(\d+)/delete", "delete_casting"), ("GET", r"/api/applications", "my_applications"),
    ("GET", r"/api/meetups", "meetups"), ("POST", r"/api/meetups", "create_meetup"),
    ("POST", r"/api/meetups/(\d+)/rsvp", "rsvp"), ("POST", r"/api/meetups/(\d+)/delete", "delete_meetup"),
    ("GET", r"/api/notifications", "notifications"), ("POST", r"/api/notifications/read", "read_notifications"),
    ("GET", r"/api/messages", "conversations"), ("GET", r"/api/messages/(\d+)", "thread"),
    ("POST", r"/api/messages/(\d+)", "send_message"),
]
ROUTES = [(m, re.compile(p + r"\Z"), h) for m, p, h in ROUTES]

CSP = ("default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; "
       "font-src https://fonts.gstatic.com; script-src 'self'; frame-ancestors 'none'; base-uri 'none'")


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "SetUP"

    def log_message(self, fmt, *args):
        if "--quiet" not in sys.argv:
            sys.stderr.write("%s %s\n" % (self.command, self.path))

    def _send(self, status, payload, ctype="application/json", extra=None):
        data = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Content-Security-Policy", CSP)
        if ctype.startswith("application/json"):
            self.send_header("Cache-Control", "no-store")
        for k, v in (extra or []):
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def _session_user(self, con):
        raw = self.headers.get("Cookie")
        if not raw:
            return None
        jar = cookies.SimpleCookie()
        try:
            jar.load(raw)
        except cookies.CookieError:
            return None
        tok = jar.get("sid")
        if not tok:
            return None
        row = con.execute("""SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
            WHERE s.token=? AND s.created > datetime('now', ?)""", (tok.value, f"-{SESSION_DAYS} days")).fetchone()
        return row

    def _cookie(self, token, max_age):
        return ("Set-Cookie", f"sid={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age}")

    def _api(self, method):
        url = urlparse(self.path)
        for m, rx, name in ROUTES:
            match = rx.match(url.path)
            if m == method and match:
                break
        else:
            return self._send(404, {"error": "Not found"})
        body = {}
        if method == "POST":
            need_json = (self.headers.get("Content-Type") or "").split(";")[0].strip() == "application/json"
            length = int(self.headers.get("Content-Length") or 0)
            if not need_json:
                return self._send(415, {"error": "JSON only"})
            if length > MAX_BODY:
                return self._send(413, {"error": "Request too large"})
            try:
                body = json.loads(self.rfile.read(length) or b"{}")
                if not isinstance(body, dict):
                    raise ValueError
            except ValueError:
                return self._send(400, {"error": "Bad JSON"})
        con = connect()
        try:
            api = Api(con, self._session_user(con), body, parse_qs(url.query))
            result = getattr(api, name)(*[int(g) for g in match.groups()])
            extra = []
            if "_login" in result:
                token = secrets.token_urlsafe(32)
                con.execute("INSERT INTO sessions VALUES(?,?,?)", (token, result.pop("_login"), now()))
                extra.append(self._cookie(token, SESSION_DAYS * 86400))
                result = {"ok": True}
            elif "_logout" in result:
                cookie = self.headers.get("Cookie") or ""
                jar = cookies.SimpleCookie()
                try:
                    jar.load(cookie)
                except cookies.CookieError:
                    pass
                if "sid" in jar:
                    con.execute("DELETE FROM sessions WHERE token=?", (jar["sid"].value,))
                extra.append(self._cookie("", 0))
                result = {"ok": True}
            con.commit()
            self._send(200, result, extra=extra)
        except ApiError as e:
            con.rollback()
            self._send(e.status, {"error": e.message})
        except Exception as e:  # keep the server alive, show a safe message
            con.rollback()
            sys.stderr.write(f"ERROR {self.path}: {e!r}\n")
            self._send(500, {"error": "Something went wrong"})
        finally:
            con.close()

    def _static(self):
        path = urlparse(self.path).path
        if path == "/":
            path = "/index.html"
        if path.startswith("/uploads/"):
            base, rel = UPLOADS, path[len("/uploads/"):]
        else:
            base, rel = STATIC, path.lstrip("/")
            if path.startswith("/static/"):
                rel = path[len("/static/"):]
        full = os.path.realpath(os.path.join(base, rel))
        if not full.startswith(os.path.realpath(base) + os.sep) or not os.path.isfile(full):
            if "." not in os.path.basename(path):  # client-side routes
                full = os.path.join(STATIC, "index.html")
            else:
                return self._send(404, b"Not found", "text/plain")
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            self._send(200, f.read(), ctype, [("Cache-Control", "no-cache")])

    def do_GET(self):
        if self.path.startswith("/api/"):
            return self._api("GET")
        self._static()

    def do_POST(self):
        if self.path.startswith("/api/"):
            return self._api("POST")
        self._send(404, b"Not found", "text/plain")


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    init_db()
    if "--seed" in sys.argv:
        import seed
        seed.run(connect, hash_pw, now)
    print(f"Set UP running on http://{HOST}:{PORT}  (Ctrl+C to stop)")
    try:
        Server((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\nBye")

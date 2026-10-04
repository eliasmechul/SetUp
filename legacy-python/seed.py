"""Demo data so the app isn't empty. Only runs on an empty database: python3 server.py --seed
All demo accounts use the password  setup1234  (local testing only)."""
from datetime import datetime, timedelta, timezone

PEOPLE = [
    ("Mara Linden", "mara@demo.setup", "Cinematographer", "Director of Photography", "Berlin",
     "DoP for shorts, music videos and documentaries. Love natural light.", "ARRI, anamorphic, documentary"),
    ("Jacob Washington", "jacob@demo.setup", "Director", "Director & writer", "Berlin",
     "Making my second short film this winter.", "Directing, writing, casting"),
    ("Nina Kovacs", "nina@demo.setup", "Producer", "Indie producer · Kino nights", "Hamburg",
     "I host the monthly Short Film Night. Always looking for new voices.", "Producing, budgeting, festivals"),
    ("Kat Williams", "kat@demo.setup", "Actor", "Actor · stage & screen", "Berlin",
     "Trained in London, based in Berlin. English / German.", "Drama, comedy, voice"),
    ("Tony Monta", "tony@demo.setup", "Editor", "Editor · colorist", "Munich",
     "Cutting narrative and commercial work.", "Premiere, DaVinci Resolve"),
    ("Sofia Reyes", "sofia@demo.setup", "Sound", "Sound designer", "Berlin",
     "Location sound and post. Boom op by day, mixer by night.", "Location sound, Foley, mixing"),
]


def run(connect, hash_pw, now):
    con = connect()
    if con.execute("SELECT COUNT(*) FROM users").fetchone()[0]:
        print("Database already has users, skipping seed")
        con.close()
        return
    h, salt = hash_pw("setup1234")
    ids = []
    for name, email, role, headline, city, bio, skills in PEOPLE:
        cur = con.execute(
            "INSERT INTO users(email,pw_hash,pw_salt,name,role,headline,city,bio,skills,created) VALUES(?,?,?,?,?,?,?,?,?,?)",
            (email, h, salt, name, role, headline, city, bio, skills, now()))
        ids.append(cur.lastrowid)
    mara, jacob, nina, kat, tony, sofia = ids
    t = now()
    for uid, text in [
        (jacob, "Looking for an actor for a short role in my upcoming film. Details in Castings."),
        (mara, "Wrapped the last day on Night Ferry. Thank you to the best camera crew."),
        (nina, "Short Film Night is back this month. Come meet other filmmakers."),
        (tony, "Winter shots are mind blowing. Colour grade in progress."),
        (sofia, "Tip: record 60 seconds of room tone on every location. Your editor will thank you."),
    ]:
        con.execute("INSERT INTO posts(user_id,body,image,created) VALUES(?,?,?,?)", (uid, text, "", t))
    con.execute("INSERT INTO connections(from_id,to_id,status,created) VALUES(?,?,?,?)", (mara, jacob, "accepted", t))
    day = lambda n: (datetime.now(timezone.utc) + timedelta(days=n)).strftime("%Y-%m-%d")
    con.executemany(
        "INSERT INTO castings(user_id,title,category,production,city,pay,deadline,description,created) VALUES(?,?,?,?,?,?,?,?,?)",
        [(jacob, "Junior actor · Lead role", "Acting", "Untitled short film", "Berlin", "Paid", day(6),
          "Looking for a junior actor (20s) for the lead of a 15-minute drama. Shoot: 3 days in November.", t),
         (nina, "Gaffer · Feature documentary", "Crew", "North Lane Pictures", "Hamburg", "Day rate", day(12),
          "Experienced gaffer for a 10-day documentary shoot. Own kit a plus.", t),
         (tony, "Voice actor · Animated series", "Voice", "Paper Moon Studio", "Remote", "Paid", day(3),
          "Warm, expressive voice for a children's animated series. Remote recording.", t)])
    con.executemany(
        "INSERT INTO meetups(user_id,title,city,venue,starts,description,created) VALUES(?,?,?,?,?,?,?)",
        [(nina, "Short Film Night", "Berlin", "Kino Rex", day(8) + "T19:00", "Screenings and drinks.", t),
         (mara, "Cinematographers Coffee", "Berlin", "Café Lumen", day(15) + "T10:00", "Gear talk, no slides.", t),
         (kat, "Script Table Read", "Berlin", "Studio 9", day(22) + "T18:30", "Open to actors and writers.", t)])
    con.commit()
    con.close()
    print("Seeded demo data. Log in as mara@demo.setup / setup1234")

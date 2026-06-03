# 🔐 Supabase RLS Setup - Quick Start

Je RLS policies zijn klaar! Volg deze stappen om ze in te voeren.

## 📋 Checklist

- [ ] Database tabellen bestaan
- [ ] Migrations zijn uitgevoerd
- [ ] RLS policies zijn actief
- [ ] Test policies
- [ ] Deploy naar productie

## 🚀 Installatie (3 stappen)

### Stap 1: Zorg dat je migrations folder juist staat

```bash
# Je hebt nu een nieuwe folder:
# supabase/migrations/
#   ├── create_additional_tables.sql
#   ├── rls_policies.sql
#   └── README.md
```

### Stap 2: Voer migrations uit

**Optie A: Via CLI (aanbevolen)**
```bash
# Installeer Supabase CLI als je dat nog niet hebt
npm install -g @supabase/cli

# Link je project
supabase link --project-id lahoorkdcopypnubnosl

# Voer migrations uit
supabase db push
```

**Optie B: Via Supabase Dashboard**
1. Open https://app.supabase.com
2. Ga naar **SQL Editor** > **New Query**
3. Plak inhoud van `supabase/migrations/create_additional_tables.sql` → **Run**
4. Plak inhoud van `supabase/migrations/rls_policies.sql` → **Run**

### Stap 3: Verificatie

Check in Supabase Dashboard:
1. **Tables**: Zie je `posts`, `forum_threads`, etc?
2. **Authentication** > **Policies**: Zijn de policies zichtbaar?
3. **SQL Editor**: Voer dit uit:
   ```sql
   select tablename, (select count(*) from pg_policies where schemaname='public' and tablename=t.tablename) as policy_count
   from pg_tables t
   where schemaname='public'
   order by tablename;
   ```

## 📚 Documentatie

- **[RLS_POLICIES_GUIDE.md](./RLS_POLICIES_GUIDE.md)** - Compleet overzicht van alle policies
- **[supabase/migrations/README.md](./supabase/migrations/README.md)** - Technische details
- **[SUPABASE_SCHEMA.md](./SUPABASE_SCHEMA.md)** - Schema documentatie

## 🧪 Testing

### Test 1: Aanmelden als gebruiker A
```sql
set request.jwt.claims = '{"sub": "user-id-a", "email": "user@a.com"}';
select * from public.profiles;
-- Zou alleen eigen profiel moeten zien
```

### Test 2: Admin permissions
```sql
-- Als admin user
select * from public.settings;
-- Moet lukken

-- Als normale user
set request.jwt.claims = '{"sub": "regular-user-id"}';
update public.settings set value = '{"test": true}' where key = 'test';
-- Zou NIET moeten lukken
```

### Test 3: Conversations
```sql
set request.jwt.claims = '{"sub": "user-1"}';
select * from public.conversations 
where user-1 = any(participants);
-- Zou conversations waar user-1 in zit moeten tonen
```

## 🔑 Admin Setup

Voor je eerste admin:
```sql
update public.profiles 
set role = 'admin' 
where email = 'your-admin@email.com';
```

Verificatie:
```sql
select email, role from public.profiles where role = 'admin';
```

## ⚠️ Production Checklist

Voor je naar productie gaat:

- [ ] Alle migrations succesvol uitgevoerd
- [ ] Policies getest met test-users
- [ ] Admin users aangesteld
- [ ] Gevoelige data NIET in public-readable tabellen
- [ ] Performance gecontroleerd (check indexes)
- [ ] Backup policy ingesteld
- [ ] Monitoring actief

## 🆘 Troubleshooting

### Migrations slaan niet aan
```bash
# Check de status
supabase migration list

# Reset (pas op: verwijdert data!)
supabase db reset
```

### "Permission denied" fouten
1. Check dat je met juiste role bent ingelogd
2. Verify RLS is enabled: `select * from pg_tables where tablename = 'your-table'`
3. Check policy syntax in Dashboard

### Performance probleem
1. Zorg voor indexes op kolommen in policies
2. Profile queries in Supabase Dashboard > Database > Performance
3. Avoid N+1 queries in client code

## 📞 Vragen?

Raadpleeg:
- [RLS_POLICIES_GUIDE.md](./RLS_POLICIES_GUIDE.md) - Uitgebreide uitleg per tabel
- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)

---

**Klaar?** 🎉 Voer je migrations uit en je RLS policies zijn live!

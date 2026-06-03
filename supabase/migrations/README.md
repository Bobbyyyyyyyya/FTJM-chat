# Supabase Migrations

Dit zijn de database migrations voor het FTJM Chat project.

## Volgorde van uitvoering

**Belangrijk**: Voer de migrations in deze volgorde uit:

1. **`create_additional_tables.sql`** - Maakt de tabellen aan
   - posts
   - forum_threads
   - forum_comments
   - reports
   - whitelist

2. **`rls_policies.sql`** - Implementeert alle Row Level Security policies

## Hoe uit te voeren

### Option 1: Via Supabase CLI (Aanbevolen)

```bash
# Zorg dat je in de root van het project bent
cd /Users/thijmen/FTJM\ chat

# Link je project (eenmalig)
supabase link --project-id lahoorkdcopypnubnosl

# Voer alle migrations uit
supabase db push
```

### Option 2: Via Supabase Dashboard (Manueel)

1. Ga naar https://app.supabase.com en open je project
2. Ga naar **SQL Editor**
3. Klik **New Query**
4. Open `supabase/migrations/create_additional_tables.sql` en plak de inhoud
5. Klik **Run**
6. Herhaal stap 3-5 voor `supabase/migrations/rls_policies.sql`

### Option 3: Direct via psql (Voor DevOps)

```bash
# Connection string vind je in Supabase Dashboard > Settings > Database
PGPASSWORD='your-password' psql -h db.lahoorkdcopypnubnosl.supabase.co \
  -U postgres -d postgres -f supabase/migrations/create_additional_tables.sql

PGPASSWORD='your-password' psql -h db.lahoorkdcopypnubnosl.supabase.co \
  -U postgres -d postgres -f supabase/migrations/rls_policies.sql
```

## Bestaande migrations

- `create_base_schema.sql` (als het bestaat) - initiële schema met profielen, berichten, etc.

## Troubleshooting

### "relation does not exist"
Dit betekent dat de migration niet is uitgevoerd. Zorg dat je migrations in de juiste volgorde runt.

### "duplicate key value violates unique constraint"
Als je een migration twee keer runt en deze aanpast, kan dit voorkomen. Gebruik `if not exists` clauses.

### RLS policies werken niet
- Controleer dat RLS enabled is op de tabel
- Zorg dat je policies correct zijn (check syntax in Supabase Dashboard)
- Controleer dat je met de juiste user bent ingelogd

## Onderhoud

Als je wijzigingen aanbrengt:
1. Maak een nieuwe migration file: `mv_description.sql`
2. Beschrijf de wijziging duidelijk in SQL comments
3. Test de migration in development VOOR productie
4. Commit naar git

## Meer informatie

- [RLS Policies Documentatie](../RLS_POLICIES_GUIDE.md)
- [Supabase Schema Documentatie](../SUPABASE_SCHEMA.md)
- [Supabase Migrations Docs](https://supabase.com/docs/guides/cli/managing-databases)

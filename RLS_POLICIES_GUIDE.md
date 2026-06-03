# RLS Policies Documentation

## Overzicht

Dit document beschrijft alle Row Level Security (RLS) policies voor de FTJM Chat Supabase database. RLS zorgt ervoor dat gebruikers alleen de data kunnen zien en aanpassen waar ze toegang toe hebben.

## Implementatie

### Optie 1: Via Supabase Dashboard (Makkelijk)

1. Ga naar je Supabase project: https://app.supabase.com
2. Open **SQL Editor**
3. Klik **New Query**
4. Plak de inhoud van `supabase/migrations/rls_policies.sql`
5. Klik **Run**

### Optie 2: Via Supabase CLI (Aanbevolen)

```bash
# Zorg dat je in de root van het project bent
cd /Users/thijmen/FTJM\ chat

# Link je Supabase project (eenmalig)
supabase link --project-id lahoorkdcopypnubnosl

# Voer de migratie uit
supabase db push
```

### Optie 3: Handmatig via migrations

```bash
# Als je Supabase migrations setup hebt
supabase migration new add_rls_policies
# Edit de nieuw gegenereerde migration in supabase/migrations/
# Plak de SQL erin en voer uit
```

## 🗂️ Tabel Overzicht

```
┌─────────────────────────────────────────────────────────┐
│              CHAT ARCHITECTURE LAYERS                   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  PUBLIC CHAT                                             │
│  ├─ posts                 → General chat iedereen ziet  │
│  ├─ forum_threads         → Discussie threads openbaar  │
│  └─ forum_comments        → Reacties op threads         │
│                                                           │
│  PRIVATE MESSAGING                                       │
│  ├─ conversations         → DM groepen (1-op-1 of meer) │
│  ├─ messages              → Berichten in gesprekken     │
│  ├─ typing                → "Iemand is aan het typen"   │
│  └─ notifications         → Alerts/geluidjes bij nieuwe │
│                                                           │
│  USER PROFILES                                           │
│  ├─ profiles              → Naam, bio, instellingen     │
│  ├─ nicknames             → Bijnamen voor @mentions     │
│  └─ settings              → Globale systeeminstellingen │
│                                                           │
│  MODERATION                                              │
│  ├─ reports               → Spammelding/klachten       │
│  └─ whitelist             → Toegangscontrole (beta)    │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Beleidregels per Tabel

### 1. **profiles** - Gebruikersprofielen (PRIVÉ PROFIEL)
| Operatie | Wie | Voorwaarde |
|----------|-----|-----------|
| SELECT | authenticated | Alleen eigen profiel (auth.uid() = id) |
| INSERT | authenticated | Alleen eigen profiel |
| UPDATE | authenticated | Alleen eigen profiel |
| DELETE | authenticated | Alleen eigen profiel |

**Gevolg**: Gebruikers kunnen hun eigen profiel beheren, maar kunnen profielen van anderen niet zien.

**Wat zit hier in:**
- `display_name` - De naam die je ziet in chats
- `bio` - Korte beschrijving van jezelf
- `photo_url` - Profielfoto
- `notification_settings` - Of je geluid wilt bij messages
- `thema` - Dark/light mode voorkeur
- `role` - admin/user/mod

---

### 2. **settings** - Globale instellingen
| Operatie | Wie | Voorwaarde |
|----------|-----|-----------|
| SELECT | public | Iedereen kan lezen (true) |
| INSERT | authenticated | Alleen admins (is_admin() = true) |
| UPDATE | authenticated | Alleen admins |
| DELETE | authenticated | Alleen admins |

**Gevolg**: Settings zijn publiekelijk leesbaar, maar alleen admins kunnen wijzigen.

**⚠️ LET OP**: Zet gevoelige data NIET in settings als je ze openbaar maakt!

---

### 3. **posts** - General Chat (OPENBARE BERICHTEN)
| Operatie | Wie | Voorwaarde |
|----------|-----|-----------|
| SELECT | public | Iedereen kan alles lezen |
| INSERT | authenticated | Alleen wanneer author_id = eigen user_id |
| INSERT | anon | Alleen wanneer author_id NOT NULL |
| UPDATE | authenticated | Alleen eigen post OF admin |
| DELETE | authenticated | Alleen eigen post OF admin |

**Gevolg**: Posts zijn openbaar zichtbaar voor IEDEREEN. Gebruikers kunnen alleen hun eigen posts bewerken.

**Dit is voor:**
- 💬 General chat channel die iedereen ziet
- 📢 Publieke berichten/announcements
- 🔓 Openbare discussie ruimte

---

### 4. **forum_threads** - Forumthreads
| Operatie | Wie | Voorwaarde |
|----------|-----|-----------|
| SELECT | public | Iedereen kan lezen |
| INSERT | authenticated | Alleen eigen thread (author_id = eigen user_id) |
| INSERT | anon | Alleen met author_id |
| UPDATE | authenticated | Alleen eigen thread OF admin |
| DELETE | authenticated | Alleen eigen thread OF admin |

**Gevolg**: Open forum, maar alleen auteurs kunnen hun threads beheren.

---

### 5. **forum_comments** - Forumreacties
| Operatie | Wie | Voorwaarde |
|----------|-----|-----------|
| SELECT | public | Iedereen kan lezen |
| INSERT | authenticated | Alleen eigen reactie (author_id = eigen user_id) |
| INSERT | anon | Alleen met author_id |
| UPDATE | authenticated | Alleen eigen reactie |
| DELETE | authenticated | Alleen eigen reactie |

**Gevolg**: Open reacties, maar gebruikers kunnen alleen hun eigen reacties aanpassen.

---

### 6. **conversations** - DM Groepen (PRIVÉ GESPREKKEN)
| Operatie | Wie | Voorwaarde |
|----------|-----|-----------|
| SELECT | authenticated | Alleen als je in participants zit |
| INSERT | authenticated | Alleen als je in participants zit |
| UPDATE | authenticated | Alleen als je in participants zit |
| DELETE | authenticated | Alleen als je in participants zit |

**Gevolg**: Volledig private messaging. Alleen deelnemers kunnen zien/bewerken.

**Dit is voor:**
- 1️⃣ 1-op-1 chats met vrienden
- 👥 Groepsgesprekken (multi-person)
- De "rule" die bepaalt wie je een gesprek mee hebt
- Houdt bij wie in de conversation zit (`participants` array)

---

### 7. **messages** - DM Berichten (PRIVÉ BERICHTEN)
| Operatie | Wie | Voorwaarde |
|----------|-----|-----------|
| SELECT | authenticated | Alleen voor participants EN deleted_at IS NULL |
| INSERT | authenticated | Alleen als sender_id = jij EN jij bent participant |
| UPDATE | authenticated | Alleen sender, non-deleted, en jij bent participant |
| DELETE | authenticated | Alleen sender, non-deleted, en jij bent participant |

**Gevolg**: Privé berichtverkeer in DMs. Berichten kunnen "soft deleted" worden (deleted_at field).

**Dit is voor:**
- 💬 De daadwerkelijke DM berichten tussen users
- Gekoppeld aan een `conversation_id`
- Alleen de mensen in die conversation kunnen zien
- Verzender kan berichten verwijderen/wijzigen

---

### 8. **typing** - Typeerstatus (LIVE INDICATOR)
| Operatie | Wie | Voorwaarde |
|----------|-----|-----------|
| SELECT | authenticated | Alleen voor participants van de conversation |
| INSERT | authenticated | Alleen je eigen typing status (user_id = jij) |
| UPDATE | authenticated | Alleen je eigen status |
| DELETE | authenticated | Alleen je eigen status |

**Gevolg**: Real-time typing indicators alleen zichtbaar voor deelnemers.

**Dit is voor:**
- ⌨️ "Iemand is aan het typen..." indicator
- Zichtbaar in real-time voor alle participants
- Automatisch verwijderd als je klaar bent typen
- Geeft user experience feedback

---

### 9. **notifications** - Meldingen
| Operatie | Wie | Voorwaarde |
|----------|-----|-----------|
| SELECT | authenticated | Alleen eigen notificaties (user_id = jij) |
| INSERT | authenticated | Alleen voor jezelf |
| UPDATE | authenticated | Alleen eigen notificaties |
| DELETE | authenticated | Alleen eigen notificaties |

**Gevolg**: Persoonlijke notificaties, niemand kan die van ander zien.

---

### 10. **nicknames** - Bijnamen
| Operatie | Wie | Voorwaarde |
|----------|-----|-----------|
| SELECT | public | Iedereen kan lezen |
| INSERT | authenticated | Alleen eigen bijnaam (user_id = jij) |
| UPDATE | authenticated | Alleen eigen bijnaam |
| DELETE | authenticated | Alleen eigen bijnaam |

**Gevolg**: Bijnamen zijn openbaar zichtbaar (nuttig voor @mentions), maar individueel beheerd.

---

### 11. **reports** - Rapportages/klachten
| Operatie | Wie | Voorwaarde |
|----------|-----|-----------|
| SELECT | authenticated | Alleen eigen reports (reporter_id = jij) |
| INSERT | authenticated | Alleen je eigen report (reporter_id = jij) |
| DELETE | - | Niet standaard toegestaan |

**Gevolg**: Reports zijn privé. Gebruikers kunnen hun eigen reports zien.

**Opmerking**: Admins kunnen reports zien via admin panel (niet in deze policies).

---

### 12. **whitelist** - Whitelist (bv. voor beta toegang)
| Operatie | Wie | Voorwaarde |
|----------|-----|-----------|
| SELECT | public | Iedereen kan lezen |
| INSERT | public | Iedereen kan toevoegen (email NOT NULL) |
| DELETE | public | Iedereen kan verwijderen |

**Gevolg**: Volledig open whitelist, iedereenhkan zichzelf toevoegen/verwijderen.

---

## Helper-functies

### `is_admin(user_id uuid)`
Controleert of een gebruiker een admin is door de `role` veld in de `profiles` tabel te checken.

```sql
-- Gebruik in policies:
where public.is_admin(auth.uid())
```

### `get_current_user_id()`
Haalt de huidige user ID op. Probeert eerst `auth.uid()`, fallback naar null.

---

## Veelgestelde vragen

### P: Hoe kan ik mijn RLS policies testen?
**A**: In Supabase Dashboard onder SQL Editor:
```sql
-- Test als authenticated user
set request.jwt.claims = '{"sub": "user-uuid-here"}';
select * from public.messages;
```

### P: Hoe geef ik een gebruiker admin rechten?
**A**: Update de `role` in profiles:
```sql
update public.profiles
set role = 'admin'
where id = 'user-uuid';
```

### P: Een policy werkt niet, hoe debug ik?
**A**: 
1. Check dat RLS enabled is: `alter table tablename enable row level security;`
2. Check de policy syntax in Supabase Dashboard > Authentication > Policies
3. Zorg dat je met de juiste user bent ingelogd
4. Check de JWT claims bevatten de juiste `sub` (user ID)

### P: Wat gebeurt er als er geen policy is?
**A**: Als RLS enabled is maar geen policies bestaan, kan NIEMAND (ook niet admins) data zien/wijzigen. Dit is intentioneel secure-by-default gedrag.

---

## Best Practices

✅ **DO:**
- Enable RLS op alle tabellen die user data bevatten
- Test policies voordat je production data toevoegt
- Documenteer waarom elke policy bestaat
- Maak aparte policies per CRUD operatie
- Gebruik helper functions voor complexe checks

❌ **DON'T:**
- Maak policies té liberaal (check je security!)
- Zet gevoelige data in public-readable tabellen
- Vertrouw op client-side security checks
- Disable RLS als je denkt dat het te langzaam is (optimize de queries ipv)

---

## Performance Tips

1. **Indexes**: Zorg voor indexes op kolommen die in WHERE clauses van policies staan
   ```sql
   create index idx_conversations_participants on conversations using gin (participants);
   ```

2. **Caching**: Het Supabase client cacht query resultaten
3. **Batch operations**: Groepeer inserts/updates waar mogelijk
4. **Monitor**: Check performance in Supabase Dashboard > Database > Performance

---

## Volgende stappen

1. Voer `supabase/migrations/rls_policies.sql` uit in je Supabase project
2. Test de policies met test-users
3. Voeg admin users toe waar nodig (`update profiles set role = 'admin'`)
4. Monitor performance en errors
5. Update deze policies naarmate je app groeit


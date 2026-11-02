INSERT INTO camp_sessions (
  season,
  age_group,
  title,
  description,
  activities,
  start_date,
  end_date,
  duration_days,
  capacity,
  registration_open
)
SELECT
  planned.season,
  planned.age_group,
  planned.title,
  planned.description,
  planned.activities,
  planned.start_date,
  planned.end_date,
  planned.duration_days,
  20,
  TRUE
FROM (
  VALUES
    (
      'winter', 'little', 'Les Petits — hiver 2027 (janvier)',
      'Quatre jours pour découvrir les joies de la neige et de la montagne en douceur.',
      'Jeux de neige, balade adaptée, découverte des traces et veillée contée.',
      DATE '2027-01-01', DATE '2027-01-04', 4
    ),
    (
      'winter', 'middle', 'Les Moyens — hiver 2027 (janvier)',
      'Une seconde semaine hivernale pour explorer la montagne et progresser en équipe.',
      'Randonnée hivernale, orientation, découverte de la faune et jeux collectifs.',
      DATE '2027-01-20', DATE '2027-01-26', 7
    ),
    (
      'winter', 'teen', 'Les Ados — hiver 2027 (février)',
      'Un séjour outdoor pour apprendre à évoluer en montagne pendant l’hiver.',
      'Trek hivernal encadré, orientation, observation de la faune et défis collectifs.',
      DATE '2027-02-20', DATE '2027-02-26', 7
    ),
    (
      'winter', 'adult', 'Adultes & Confirmés — hiver 2027 (mars)',
      'Une semaine sportive pour progresser et mieux connaître les risques en montagne.',
      'Randonnée hivernale, lecture de terrain, sécurité et découverte des écosystèmes.',
      DATE '2027-03-10', DATE '2027-03-16', 7
    ),
    (
      'summer', 'little', 'Les Petits — été 2027 (juin)',
      'Quatre jours pour faire ses premiers pas d’éco-aventuriers dans les Alpes.',
      'Randonnées ludiques, chasse aux traces, atelier nature et contes.',
      DATE '2027-06-01', DATE '2027-06-04', 4
    ),
    (
      'summer', 'middle', 'Les Moyens — été 2027 (juillet)',
      'Une semaine pour explorer la biodiversité alpine et protéger les milieux naturels.',
      'Orientation, rencontre avec un berger, activité sportive adaptée et jeux nature.',
      DATE '2027-07-05', DATE '2027-07-11', 7
    ),
    (
      'summer', 'teen', 'Les Ados — été 2027 (août)',
      'Un séjour sportif pour découvrir la haute montagne et agir pour les sentiers alpins.',
      'Trek encadré, observation de la faune, activité sportive selon les conditions et chantier participatif.',
      DATE '2027-08-01', DATE '2027-08-07', 7
    ),
    (
      'summer', 'adult', 'Adultes & Confirmés — été 2027 (août)',
      'Une semaine de progression outdoor et de découverte de la montagne estivale.',
      'Grande randonnée, bivouac responsable et découverte de la biodiversité alpine.',
      DATE '2027-08-25', DATE '2027-08-31', 7
    )
) AS planned(
  season,
  age_group,
  title,
  description,
  activities,
  start_date,
  end_date,
  duration_days
)
WHERE NOT EXISTS (
  SELECT 1
  FROM camp_sessions existing
  WHERE existing.season = planned.season
    AND existing.age_group = planned.age_group
    AND existing.start_date = planned.start_date
);

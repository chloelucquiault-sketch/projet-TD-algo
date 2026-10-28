ALTER TABLE camp_sessions
  ALTER COLUMN created_by_user_id DROP NOT NULL;

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
      'winter', 'little', 'Les Petits — hiver 2026',
      'Une première aventure hivernale, au rythme des enfants, entre jeux de neige et découverte de la montagne.',
      'Balades en raquettes adaptées, jeux de neige, observation des traces et veillée contée.',
      DATE '2026-12-15', DATE '2026-12-18', 4
    ),
    (
      'winter', 'middle', 'Les Moyens — hiver 2027',
      'Une semaine pour explorer la montagne en hiver et apprendre à évoluer en équipe dans la neige.',
      'Randonnées hivernales, orientation, découverte de la faune et grands jeux en extérieur.',
      DATE '2027-01-10', DATE '2027-01-16', 7
    ),
    (
      'winter', 'teen', 'Les Ados — hiver 2027',
      'Un séjour outdoor pour découvrir les paysages d’altitude et les bons réflexes en montagne.',
      'Trek hivernal encadré, orientation, observation de la faune et défis sportifs collectifs.',
      DATE '2027-02-07', DATE '2027-02-13', 7
    ),
    (
      'winter', 'adult', 'Adultes & Confirmés — hiver 2027',
      'Une semaine sportive pour progresser et mieux connaître les risques et les écosystèmes de montagne.',
      'Randonnée hivernale sportive, lecture de terrain, sécurité en montagne et échanges sur le tourisme durable.',
      DATE '2027-03-21', DATE '2027-03-27', 7
    ),
    (
      'summer', 'little', 'Les Petits — été 2027',
      'Quatre jours pour faire ses premiers pas d’éco-aventuriers dans les Alpes.',
      'Randonnées ludiques, chasse aux traces, atelier des petits gardiens de la montagne et contes.',
      DATE '2027-05-10', DATE '2027-05-13', 4
    ),
    (
      'summer', 'middle', 'Les Moyens — été 2027',
      'Une semaine pour explorer la biodiversité alpine et apprendre à protéger les milieux naturels.',
      'Orientation, rencontre avec un berger, activité d’escalade ou accrobranche et jeux éco-responsables.',
      DATE '2027-06-20', DATE '2027-06-26', 7
    ),
    (
      'summer', 'teen', 'Les Ados — été 2027',
      'Un séjour sportif pour découvrir la haute montagne et agir en faveur des sentiers alpins.',
      'Trek encadré, observation de la faune, VTT ou randonnée aquatique selon les conditions, chantier participatif.',
      DATE '2027-07-18', DATE '2027-07-24', 7
    ),
    (
      'summer', 'adult', 'Adultes & Confirmés — été 2027',
      'Une semaine de progression outdoor et de découverte des enjeux de la montagne estivale.',
      'Grande randonnée, bivouac responsable, cartographie de la biodiversité et échanges avec des acteurs locaux.',
      DATE '2027-08-15', DATE '2027-08-21', 7
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

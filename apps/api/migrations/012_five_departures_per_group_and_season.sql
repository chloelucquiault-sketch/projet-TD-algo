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
      DATE '2027-01-10', DATE '2027-01-13', 4
    ),
    (
      'winter', 'little', 'Les Petits — hiver 2027 (janvier, 2e départ)',
      'Un nouveau départ hivernal pour les premiers pas des petits en montagne.',
      'Jeux de neige, promenade adaptée, observation de la faune et contes.',
      DATE '2027-01-20', DATE '2027-01-23', 4
    ),
    (
      'winter', 'little', 'Les Petits — hiver 2027 (février)',
      'Quatre jours de jeux et de découvertes dans les paysages enneigés.',
      'Jeux de neige, balade en raquettes adaptée, traces d’animaux et veillée.',
      DATE '2027-02-01', DATE '2027-02-04', 4
    ),
    (
      'winter', 'middle', 'Les Moyens — hiver 2027 (février)',
      'Une semaine pour explorer la montagne et progresser en équipe.',
      'Randonnée hivernale, orientation, découverte de la faune et jeux collectifs.',
      DATE '2027-02-01', DATE '2027-02-07', 7
    ),
    (
      'winter', 'middle', 'Les Moyens — hiver 2027 (février, 2e départ)',
      'Un second séjour pour découvrir les paysages alpins et la vie en montagne.',
      'Orientation, randonnée adaptée, observation de la faune et grands jeux.',
      DATE '2027-02-15', DATE '2027-02-21', 7
    ),
    (
      'winter', 'middle', 'Les Moyens — hiver 2027 (mars)',
      'Une dernière semaine hivernale pour partager une aventure en équipe.',
      'Randonnées hivernales, découverte de la faune, orientation et jeux en plein air.',
      DATE '2027-03-01', DATE '2027-03-07', 7
    ),
    (
      'winter', 'teen', 'Les Ados — hiver 2026 (décembre)',
      'Un séjour outdoor pour apprendre à évoluer en montagne pendant l’hiver.',
      'Trek hivernal encadré, orientation, observation de la faune et défis collectifs.',
      DATE '2026-12-20', DATE '2026-12-26', 7
    ),
    (
      'winter', 'teen', 'Les Ados — hiver 2027 (janvier)',
      'Une semaine sportive pour découvrir les paysages alpins et les bons réflexes.',
      'Randonnée hivernale encadrée, orientation et défis collectifs.',
      DATE '2027-01-10', DATE '2027-01-16', 7
    ),
    (
      'winter', 'teen', 'Les Ados — hiver 2027 (mars)',
      'Un séjour d’hiver pour explorer la montagne et renforcer son autonomie.',
      'Trek encadré, lecture de terrain, observation et sécurité en montagne.',
      DATE '2027-03-01', DATE '2027-03-07', 7
    ),
    (
      'winter', 'adult', 'Adultes & Confirmés — hiver 2026 (décembre)',
      'Une semaine sportive pour progresser et mieux connaître les risques en montagne.',
      'Randonnée hivernale, lecture de terrain, sécurité et découverte des écosystèmes.',
      DATE '2026-12-27', DATE '2027-01-02', 7
    ),
    (
      'winter', 'adult', 'Adultes & Confirmés — hiver 2027 (janvier)',
      'Une semaine de progression outdoor et de découverte de la montagne hivernale.',
      'Randonnée sportive, orientation, sécurité en montagne et échanges en équipe.',
      DATE '2027-01-15', DATE '2027-01-21', 7
    ),
    (
      'winter', 'adult', 'Adultes & Confirmés — hiver 2027 (février)',
      'Un séjour sportif pour améliorer sa lecture du terrain et sa pratique hivernale.',
      'Randonnée, cartographie, sécurité et découverte des milieux alpins.',
      DATE '2027-02-10', DATE '2027-02-16', 7
    ),
    (
      'summer', 'little', 'Les Petits — été 2027 (juin, 2e départ)',
      'Quatre jours d’aventure nature et de jeux en plein air dans les Alpes.',
      'Balades ludiques, chasse aux traces, jeux coopératifs et contes.',
      DATE '2027-06-15', DATE '2027-06-18', 4
    ),
    (
      'summer', 'little', 'Les Petits — été 2027 (juillet)',
      'Une nouvelle aventure estivale pour découvrir la montagne à son rythme.',
      'Randonnées ludiques, observation de la nature, jeux et histoires.',
      DATE '2027-07-01', DATE '2027-07-04', 4
    ),
    (
      'summer', 'little', 'Les Petits — été 2027 (août)',
      'Quatre jours pour devenir de petits explorateurs des Alpes.',
      'Balades adaptées, atelier nature, jeux collectifs et veillée contée.',
      DATE '2027-08-01', DATE '2027-08-04', 4
    ),
    (
      'summer', 'middle', 'Les Moyens — été 2027 (mai)',
      'Une semaine pour explorer la biodiversité alpine et apprendre à la préserver.',
      'Orientation, découverte de la faune et flore, jeux nature et randonnée.',
      DATE '2027-05-20', DATE '2027-05-26', 7
    ),
    (
      'summer', 'middle', 'Les Moyens — été 2027 (août)',
      'Un séjour estival pour découvrir les paysages alpins et agir en équipe.',
      'Randonnée, orientation, activité sportive adaptée et jeux éco-responsables.',
      DATE '2027-08-01', DATE '2027-08-07', 7
    ),
    (
      'summer', 'middle', 'Les Moyens — été 2027 (août, 2e départ)',
      'Une seconde semaine pour explorer la biodiversité et les sentiers de montagne.',
      'Orientation, randonnée, découverte de la faune et grands jeux.',
      DATE '2027-08-20', DATE '2027-08-26', 7
    ),
    (
      'summer', 'teen', 'Les Ados — été 2027 (mai)',
      'Un séjour sportif pour découvrir la montagne et prendre soin des sentiers.',
      'Trek encadré, observation de la faune, cartographie et chantier participatif.',
      DATE '2027-05-15', DATE '2027-05-21', 7
    ),
    (
      'summer', 'teen', 'Les Ados — été 2027 (juin)',
      'Une semaine d’aventure pour gagner en autonomie et explorer les Alpes.',
      'Randonnée, orientation, découverte des milieux naturels et défis collectifs.',
      DATE '2027-06-10', DATE '2027-06-16', 7
    ),
    (
      'summer', 'teen', 'Les Ados — été 2027 (septembre)',
      'Un séjour de fin d’été pour parcourir les sentiers et découvrir la haute montagne.',
      'Trek encadré, observation de la faune, orientation et randonnée aquatique selon conditions.',
      DATE '2027-09-01', DATE '2027-09-07', 7
    ),
    (
      'summer', 'adult', 'Adultes & Confirmés — été 2027 (mai)',
      'Une semaine de progression outdoor au début de la saison estivale.',
      'Grande randonnée, cartographie de la biodiversité et échanges avec des acteurs locaux.',
      DATE '2027-05-10', DATE '2027-05-16', 7
    ),
    (
      'summer', 'adult', 'Adultes & Confirmés — été 2027 (juin)',
      'Un séjour sportif pour progresser et mieux connaître les écosystèmes alpins.',
      'Randonnée sportive, lecture de terrain et découverte de la biodiversité.',
      DATE '2027-06-10', DATE '2027-06-16', 7
    ),
    (
      'summer', 'adult', 'Adultes & Confirmés — été 2027 (juillet)',
      'Une semaine outdoor pour préparer ses randonnées et explorer les Alpes.',
      'Grande randonnée, cartographie, sécurité et observation de la nature.',
      DATE '2027-07-10', DATE '2027-07-16', 7
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

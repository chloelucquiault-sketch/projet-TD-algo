DELETE FROM facility_sports
WHERE sport_id IN (
  SELECT id FROM sports
  WHERE slug IN ('football', 'rugby', 'ultimate-frisbee', 'athletisme', 'musculation', 'natation')
);

DELETE FROM sports
WHERE slug IN ('football', 'rugby', 'ultimate-frisbee', 'athletisme', 'musculation', 'natation');

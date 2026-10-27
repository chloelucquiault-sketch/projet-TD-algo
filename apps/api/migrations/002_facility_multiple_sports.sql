CREATE TABLE facility_sports (
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES sports(id),
  PRIMARY KEY (facility_id, sport_id)
);

INSERT INTO facility_sports (facility_id, sport_id)
SELECT id, sport_id FROM facilities;

CREATE INDEX facility_sports_sport_idx ON facility_sports(sport_id, facility_id);

ALTER TABLE facilities DROP COLUMN sport_id;

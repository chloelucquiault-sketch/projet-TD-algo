ALTER TABLE camp_sessions
  ADD CONSTRAINT camp_sessions_season_window_check CHECK (
    (
      season = 'summer'
      AND EXTRACT(MONTH FROM start_date)::INTEGER * 100 + EXTRACT(DAY FROM start_date)::INTEGER BETWEEN 510 AND 930
      AND EXTRACT(MONTH FROM end_date)::INTEGER * 100 + EXTRACT(DAY FROM end_date)::INTEGER BETWEEN 510 AND 930
    )
    OR (
      season = 'winter'
      AND (
        EXTRACT(MONTH FROM start_date)::INTEGER * 100 + EXTRACT(DAY FROM start_date)::INTEGER >= 1215
        OR EXTRACT(MONTH FROM start_date)::INTEGER * 100 + EXTRACT(DAY FROM start_date)::INTEGER <= 331
      )
      AND (
        EXTRACT(MONTH FROM end_date)::INTEGER * 100 + EXTRACT(DAY FROM end_date)::INTEGER >= 1215
        OR EXTRACT(MONTH FROM end_date)::INTEGER * 100 + EXTRACT(DAY FROM end_date)::INTEGER <= 331
      )
    )
  );

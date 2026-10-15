-- Un service ne porte plus de nom générique ("Déjeuner", "Dîner") : il s'appelle par son horaire,
-- comme lib/service-label.ts ("Service de midi à 15h", "Service de 18h à 20h30").
UPDATE "ServiceDefinition"
SET "name" = 'Service de ' ||
  CASE
    WHEN "startTime" = '12:00' THEN 'midi'
    WHEN "startTime" = '00:00' THEN 'minuit'
    WHEN substr("startTime", 4, 2) = '00' THEN CAST(substr("startTime", 1, 2) AS INTEGER) || 'h'
    ELSE CAST(substr("startTime", 1, 2) AS INTEGER) || 'h' || substr("startTime", 4, 2)
  END
  || ' à ' ||
  CASE
    WHEN "endTime" = '12:00' THEN 'midi'
    WHEN "endTime" = '00:00' THEN 'minuit'
    WHEN substr("endTime", 4, 2) = '00' THEN CAST(substr("endTime", 1, 2) AS INTEGER) || 'h'
    ELSE CAST(substr("endTime", 1, 2) AS INTEGER) || 'h' || substr("endTime", 4, 2)
  END;

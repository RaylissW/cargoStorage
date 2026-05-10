CREATE OR REPLACE FUNCTION update_bin_volume()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
UPDATE bin
SET current_volume = current_volume + (SELECT volume FROM cargo WHERE id = NEW.cargo_id) * NEW.quantity
WHERE id = NEW.bin_id;
ELSIF (TG_OP = 'UPDATE') THEN
UPDATE bin
SET current_volume = current_volume
                         - (SELECT volume FROM cargo WHERE id = OLD.cargo_id) * OLD.quantity
    + (SELECT volume FROM cargo WHERE id = NEW.cargo_id) * NEW.quantity
WHERE id = NEW.bin_id;
ELSIF (TG_OP = 'DELETE') THEN
UPDATE bin
SET current_volume = current_volume - (SELECT volume FROM cargo WHERE id = OLD.cargo_id) * OLD.quantity
WHERE id = OLD.bin_id;
END IF;
RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bin_volume_update
    AFTER INSERT OR UPDATE OR DELETE ON bin_cargo
    FOR EACH ROW EXECUTE FUNCTION update_bin_volume();
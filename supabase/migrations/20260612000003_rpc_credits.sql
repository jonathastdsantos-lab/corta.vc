-- Função atômica para decrementar créditos com verificação de saldo
CREATE OR REPLACE FUNCTION public.decrement_credits(user_id_param uuid, amount int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_credits int;
BEGIN
  UPDATE profiles
  SET credits = credits - amount
  WHERE id = user_id_param AND credits >= amount
  RETURNING credits INTO new_credits;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Créditos insuficientes';
  END IF;

  RETURN new_credits;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_credits TO service_role;

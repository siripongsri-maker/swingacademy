
REVOKE EXECUTE ON FUNCTION public.is_enrolled(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_class_staff(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_enrolled(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_class_staff(uuid, uuid) TO authenticated, service_role;

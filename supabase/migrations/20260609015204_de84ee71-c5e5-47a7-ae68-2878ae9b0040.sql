INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE lower(u.email) = 'siripong.sri@swingth.org'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'staff'::app_role
FROM auth.users u
WHERE lower(u.email) = 'siripong.sri@swingth.org'
ON CONFLICT (user_id, role) DO NOTHING;
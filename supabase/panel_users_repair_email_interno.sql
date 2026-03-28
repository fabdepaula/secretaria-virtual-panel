-- Opcional: alinhar `email_interno` ao padrão `{login}@painel.local` quando foi salvo o e-mail real por engano.
-- Depois de rodar, no Supabase: Authentication → Users → para cada usuário afetado, edite o e-mail
-- para o mesmo valor de `panel_users.email_interno` (ou exclua e crie de novo pelo painel).

update public.panel_users u
set email_interno = lower(trim(u.login)) || '@painel.local'
where u.login is not null
  and trim(u.login) <> ''
  and u.email_interno is not null
  and lower(u.email_interno) not like '%@painel.local';

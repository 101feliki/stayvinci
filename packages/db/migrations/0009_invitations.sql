-- 0009 Invitations: a person invited to a team can see the name of the House that invited
-- them (to accept or ignore it). Nothing else about the House becomes visible.

drop policy tenant_read on tenant;
create policy tenant_read on tenant for select to sv_app, sv_platform using (
  id = app_current_tenant()
  or app_is_platform()
  or exists (select 1 from membership m
             where m.tenant_id = tenant.id and m.user_id = app_current_user()
               and m.status in ('active', 'invited'))
);

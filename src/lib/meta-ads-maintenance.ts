/**
 * Quando `true`, a feature "Criar Campanha Meta" fica em manutenção:
 *   - sidebar mostra badge "Em manutenção" + ícone de lock
 *   - clique no item de nav é bloqueado (preventDefault)
 *   - acessar `/dashboard/meta-ads` direto pela URL redireciona pra dashboard
 *     com splash de manutenção (renderizado no server component da rota)
 *
 * Pra reativar: defina como `false`. Sem migration, sem deploy especial.
 */
export const META_ADS_MAINTENANCE = true;

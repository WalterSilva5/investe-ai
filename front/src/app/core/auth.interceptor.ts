import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('wsi.accessToken');
  const tenantId = localStorage.getItem('wsi.tenantId');

  let headers = req.headers;
  if (token) headers = headers.set('Authorization', `Bearer ${token}`);
  if (tenantId) headers = headers.set('x-tenant-id', tenantId);

  return next(req.clone({ headers }));
};

import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { callerInterceptor } from './caller.interceptor';
import { Session } from './session';

/* callerInterceptor: the X-User-Id header is how the API knows the caller until login exists. */
describe('callerInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: Session;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([callerInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
    session.accounts.set([{ id: 7, displayName: 'Sam Lee', roles: ['HomeCook'], handle: null }]);
  });

  afterEach(() => backend.verify());

  it('sends the signed-in account id with a request to the API', () => {
    session.signIn(7);

    http.get('/api/feed').subscribe();

    expect(backend.expectOne('/api/feed').request.headers.get('X-User-Id')).toBe('7');
  });

  it('sends no header for a guest', () => {
    http.get('/api/feed').subscribe();

    expect(backend.expectOne('/api/feed').request.headers.has('X-User-Id')).toBe(false);
  });

  it('sends no header once the account signs out', () => {
    session.signIn(7);
    session.signOut();

    http.get('/api/feed').subscribe();

    expect(backend.expectOne('/api/feed').request.headers.has('X-User-Id')).toBe(false);
  });

  it('leaves a request to anywhere else alone', () => {
    session.signIn(7);

    http.get('/images/recipes/5.svg').subscribe();

    expect(backend.expectOne('/images/recipes/5.svg').request.headers.has('X-User-Id')).toBe(false);
  });
});

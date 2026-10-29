import { parsePagination } from './pagination';
describe('Paginación segura', () => {
  it.each(['Infinity', '-Infinity', '1e309', '9007199254740991', 'texto'])(
    'normaliza page=%s',
    (page) => {
      expect(parsePagination(page, 20)).toEqual({
        page: 1,
        limit: 20,
        skip: 0,
      });
    },
  );
  it('limita el tamaño y mantiene offsets finitos', () => {
    expect(parsePagination(2, 500)).toEqual({ page: 2, limit: 50, skip: 50 });
    expect(parsePagination(2, 'Infinity')).toEqual({
      page: 2,
      limit: 20,
      skip: 20,
    });
  });
});

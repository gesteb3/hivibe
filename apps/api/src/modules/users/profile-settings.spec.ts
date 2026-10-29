import { validate } from 'class-validator';
import { UpdateProfileDto } from './dto/update-profile.dto';
describe('Estado y tema de perfil', () => {
  it('acepta estado corto y temas predefinidos', async () => {
    const dto = Object.assign(new UpdateProfileDto(), {
      statusMessage: 'Estudiando',
      profileTheme: 'ocean',
    });
    expect(await validate(dto)).toHaveLength(0);
  });
  it('rechaza CSS libre, tema arbitrario y estado demasiado largo', async () => {
    const dto = Object.assign(new UpdateProfileDto(), {
      statusMessage: 'x'.repeat(81),
      profileTheme: 'url(javascript:alert(1))',
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property).sort()).toEqual([
      'profileTheme',
      'statusMessage',
    ]);
  });
});

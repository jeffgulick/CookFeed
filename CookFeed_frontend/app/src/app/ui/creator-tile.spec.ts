import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CreatorTile as CreatorTileData } from '../core/api-types';
import { CreatorTile } from './creator-tile';

/* One creator as a tile (the prototype's renderCreators): their picture, name, the verified mark and their handle;
   the whole tile leads to their storefront. */
describe('Creator tile', () => {
  const maria: CreatorTileData = {
    handle: 'maria-cooks',
    displayName: 'Maria Conti',
    avatarUrl: 'images/creators/maria-cooks.svg',
    isVerified: true,
  };

  let tile: HTMLElement;

  async function show(creator: CreatorTileData): Promise<void> {
    TestBed.configureTestingModule({ imports: [CreatorTile], providers: [provideRouter([])] });
    const fixture: ComponentFixture<CreatorTile> = TestBed.createComponent(CreatorTile);
    fixture.componentRef.setInput('creator', creator);
    await fixture.whenStable();
    tile = fixture.nativeElement as HTMLElement;
  }

  it('names the creator, shows the handle, and links to the storefront', async () => {
    await show(maria);

    expect(tile.getAttribute('data-creator-handle')).toBe('maria-cooks');
    expect(tile.querySelector('h3 a')?.textContent?.trim()).toBe('Maria Conti');
    expect(tile.querySelector('h3 a')?.getAttribute('href')).toBe('/creators/maria-cooks');
    expect(tile.textContent).toContain('@maria-cooks');
    expect(tile.querySelector('img')?.getAttribute('src')).toBe('/images/creators/maria-cooks.svg');
    expect(tile.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('marks a verified creator in words, not only with a tick', async () => {
    await show(maria);

    expect(tile.querySelector('.tag-good')?.textContent?.trim()).toBe('Verified');
  });

  it('leaves the mark off a creator who is not verified', async () => {
    await show({ ...maria, handle: 'dan-meal-preps', displayName: 'Dan Okafor', isVerified: false });

    expect(tile.querySelector('.tag-good')).toBeNull();
  });

  it('shows no broken picture for a creator without one', async () => {
    await show({ ...maria, avatarUrl: null });

    expect(tile.querySelector('img')).toBeNull();
    expect(tile.querySelector('[data-initial]')?.textContent?.trim()).toBe('M');
  });
});

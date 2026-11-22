import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';
import { HelpPage } from './help';

/* The Help page (the prototype's help.html): the questions a first-time visitor asks, each with its answer, and
   links on to the pages the answers name. It reads nothing from the API. */
describe('Help page', () => {
  let fixture: ComponentFixture<HelpPage>;
  let page: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [HelpPage], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(HelpPage);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
  });

  const questions = () => Array.from(page.querySelectorAll('h2')).map((h) => h.textContent?.trim());

  it('names itself with one main heading', () => {
    expect(page.querySelectorAll('h1').length).toBe(1);
    expect(page.querySelector('h1')?.textContent).toContain('Questions and answers');
    expect(page.textContent).toContain('The short version of how Cookfeed works.');
  });

  it('opens with what a meal plan and a collection are, since the store sells both', () => {
    expect(questions()[0]).toBe('What is the difference between a meal plan and a collection?');
    expect(page.querySelector('[data-answer]')?.textContent).toContain('Family Week on a Budget has 5 recipes and 6 meals');
  });

  it('answers what buying gets you, who may review, and why an account cannot buy', () => {
    expect(questions()).toContain('What do I get when I buy one?');
    expect(questions()).toContain('Who can write a review?');
    expect(questions()).toContain('Can I buy more than one copy?');
    expect(questions()).toContain('Why is there no Add to cart on my own plan?');
    expect(questions()).toContain('Why does the admin account see no cart or Save buttons?');
    expect(questions()).toContain('What is My studio?');
    expect(questions()).toContain('Is this the real store?');
  });

  it('gives every question an answer, as a section named by its question', () => {
    const sections = Array.from(page.querySelectorAll('section[data-question]'));

    expect(sections.length).toBe(questions().length);
    for (const section of sections) {
      const heading = section.querySelector('h2');
      expect(section.getAttribute('aria-labelledby')).toBe(heading?.id);
      expect(heading?.id).toBeTruthy();
      expect(section.querySelector('[data-answer]')?.textContent?.trim().length).toBeGreaterThan(20);
    }
  });

  it('does not describe Cookfeed as a prototype kept in the browser', () => {
    expect(page.textContent).not.toContain('prototype');
    expect(page.textContent).not.toContain('kept in this browser');
  });

  it('leads on to the plans and to the sign-in page', () => {
    expect(page.querySelector('a[href="/plans"]')?.textContent).toContain('Browse the plans');
    expect(page.querySelector('a[href="/sign-in"]')?.textContent).toContain('pick an account');
  });

  it('has no accessibility violations a structural check can find', async () => {
    const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });

    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});

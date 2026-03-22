import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';

expect.extend(toHaveNoViolations);

const SimpleButton = ({ label }: { label: string }) => (
  <button type="button" aria-label={label}>{label}</button>
);

const FormWithLabels = () => (
  <form>
    <label htmlFor="email">Email</label>
    <input id="email" type="email" name="email" />
    <label htmlFor="password">Password</label>
    <input id="password" type="password" name="password" />
    <button type="submit">Sign in</button>
  </form>
);

const ImageWithAlt = () => (
  <img src="/icon.svg" alt="Application logo" width={32} height={32} />
);

const NavWithLandmarks = () => (
  <div>
    <header role="banner"><h1>App</h1></header>
    <nav role="navigation" aria-label="Main navigation">
      <ul>
        <li><a href="/dashboard">Dashboard</a></li>
        <li><a href="/calendar">Calendar</a></li>
      </ul>
    </nav>
    <main role="main"><p>Content</p></main>
  </div>
);

describe('Accessibility — WCAG Compliance', () => {
  it('button with aria-label has no violations', async () => {
    const { container } = render(<SimpleButton label="Create post" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('form with proper labels has no violations', async () => {
    const { container } = render(<FormWithLabels />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('image with alt text has no violations', async () => {
    const { container } = render(<ImageWithAlt />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('page with landmarks has no violations', async () => {
    const { container } = render(<NavWithLandmarks />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('button without label fails accessibility check', async () => {
    const BadButton = () => <button><img src="/icon.svg" /></button>;
    const { container } = render(<BadButton />);
    const results = await axe(container);
    expect(results.violations.length).toBeGreaterThan(0);
  });
});

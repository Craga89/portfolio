// The colour tokens of each theme, with each text colour's contrast on the surfaces it sits on.
import Example from '../examples/Colours.astro';

export default { component: Example };

export const Dark = { args: { theme: 'dark' } };
export const Light = { args: { theme: 'light' } };
export const DarkMoreContrast = { args: { theme: 'dark-more' } };
export const LightMoreContrast = { args: { theme: 'light-more' } };
export const Print = { args: { theme: 'print' } };

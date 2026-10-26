import { Anchor, Button, type AnchorProps, type ButtonProps } from '@mantine/core';
import { createLink, type LinkComponent } from '@tanstack/react-router';
import { forwardRef, type AnchorHTMLAttributes } from 'react';

// Mantine components as type-safe router links (params and search are checked per route).

const AnchorBase = forwardRef<
  HTMLAnchorElement,
  AnchorProps & AnchorHTMLAttributes<HTMLAnchorElement>
>((props, ref) => <Anchor ref={ref} {...props} />);
const CreatedAnchorLink = createLink(AnchorBase);
export const AnchorLink: LinkComponent<typeof AnchorBase> = (props) => (
  <CreatedAnchorLink preload="intent" {...props} />
);

const ButtonBase = forwardRef<
  HTMLAnchorElement,
  ButtonProps & AnchorHTMLAttributes<HTMLAnchorElement>
>((props, ref) => <Button ref={ref} component="a" {...props} />);
const CreatedButtonLink = createLink(ButtonBase);
export const ButtonLink: LinkComponent<typeof ButtonBase> = (props) => (
  <CreatedButtonLink preload="intent" {...props} />
);

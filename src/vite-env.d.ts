/// <reference types="vite/client" />

// Behold (behold.so) Instagram-виджет — кастомный HTML-элемент.
declare namespace JSX {
  interface IntrinsicElements {
    'behold-widget': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & { 'feed-id'?: string },
      HTMLElement
    >;
  }
}

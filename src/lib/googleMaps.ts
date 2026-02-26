import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

// Configure once when this module is first imported.
// All importLibrary() calls across the app share this config.
setOptions({
    key: import.meta.env.VITE_GOOGLE_MAPS_KEY as string,
    v: 'weekly',
    libraries: ['places'],
});

export { importLibrary };

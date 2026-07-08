import { useI18n } from "@/i18n";

/**
 * Convenience hook — mirrors react-i18next's shape so components read naturally.
 * Returns `t` (translator) and `i18n` handle with `language` + `changeLanguage`.
 */
export function useTranslation() {
  const { t, locale, setLocale } = useI18n();
  return {
    t,
    i18n: {
      language: locale,
      changeLanguage: setLocale,
    },
  };
}

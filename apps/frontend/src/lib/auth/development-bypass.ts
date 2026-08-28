type DevelopmentAuthBypassEnvironment = {
  appEnv: string | undefined;
  flag: string | undefined;
  nodeEnv: string | undefined;
};

export function isDevelopmentAuthBypassEnabled({
  appEnv,
  flag,
  nodeEnv,
}: DevelopmentAuthBypassEnvironment) {
  return nodeEnv === "development" && appEnv === "local" && flag === "true";
}

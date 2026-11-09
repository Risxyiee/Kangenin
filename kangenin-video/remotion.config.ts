import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(88);
Config.setConcurrency(2);
Config.setOverwriteOutput(true);
Config.setChromiumDisableWebSecurity(false);

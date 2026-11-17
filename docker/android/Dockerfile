# Android toolchain for building the app and testing it on an emulator, so nothing
# Android-specific is installed on the developer's machine or in CI. Run it with
# --device /dev/kvm (the emulator needs hardware acceleration) and --network host
# (the emulator reaches the stack through adb reverse on localhost).
FROM eclipse-temurin:21.0.8_9-jdk-noble

RUN apt-get update && apt-get install -y --no-install-recommends \
      unzip curl ca-certificates \
      libpulse0 libgl1 libnss3 libxcomposite1 libxcursor1 libxdamage1 libxi6 libxtst6 \
      libxrandr2 libasound2t64 libdbus-1-3 libfontconfig1 libxkbfile1 libx11-xcb1 libbsd0 \
    && rm -rf /var/lib/apt/lists/*

ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/opt/android-sdk/emulator:/opt/maestro/bin

RUN curl -fsSL -o /tmp/tools.zip https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip \
    && mkdir -p $ANDROID_HOME/cmdline-tools \
    && unzip -q /tmp/tools.zip -d $ANDROID_HOME/cmdline-tools \
    && mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest \
    && rm /tmp/tools.zip

RUN yes | sdkmanager --licenses >/dev/null \
    && sdkmanager --install "platform-tools" "platforms;android-36" "build-tools;35.0.0" "build-tools;36.0.0" \
       "emulator" "system-images;android-35;google_apis;x86_64" >/dev/null \
    && echo no | avdmanager create avd -n test -k "system-images;android-35;google_apis;x86_64" -d pixel_6

RUN curl -fsSL -o /tmp/maestro.zip https://github.com/mobile-dev-inc/maestro/releases/download/cli-2.12.0/maestro.zip \
    && unzip -q /tmp/maestro.zip -d /opt \
    && rm /tmp/maestro.zip \
    && maestro --version

WORKDIR /work

# jq: the test runner reads Kratos's and the API's answers.
RUN apt-get update && apt-get install -y --no-install-recommends jq && rm -rf /var/lib/apt/lists/*

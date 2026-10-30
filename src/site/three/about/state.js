// Written by the About section's scroll handler, read inside the stage's useFrame.
// Kept apart from AboutStage so the section can import it without pulling in three.
export const about = {
  beat: 0,       // 0..n-1, which chapter the cloud is on (fractional while it flies)
  out: 0,        // 0..1, the cloud falling away at the end of the section
  active: false, // the stage is on screen and should render
};

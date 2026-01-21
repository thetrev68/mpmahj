use mahjong_core::event::{analysis_events::AnalysisEvent, Event};
use mahjong_core::hint::HintData;

#[test]
fn test_hint_update_is_private() {
    let event = Event::Analysis(AnalysisEvent::HintUpdate {
        hint: HintData::empty(),
    });
    assert!(event.is_private(), "HintUpdate must be private event");
}

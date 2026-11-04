import type {NavigationSession} from "../navigation/simulator";
import {placeName,type Language} from "./messages";
/** Status is rendered from state codes, never by replacing English instruction prose. */
export function simulationMessage(session:NavigationSession,language:Language):string{
 if(language==="en")return session.message;
 if(session.status==="at-stop")return `आप ${placeName(session.currentStop?.name??"",language)} पर पहुँच गए हैं। तैयार होने पर आगे बढ़ें।`;
 if(session.status==="arrived")return `आप ${placeName(session.route.nodes.at(-1)?.name??"",language)} पर पहुँच गए हैं। सिमुलेशन पूरा हुआ।`;
 if(session.status==="blocked")return session.pending?"यात्रा का वर्तमान साधन अनुपलब्ध है। स्थिति बहाल होने तक सिमुलेशन यहीं रुका रहेगा।":"कोई उपलब्ध मार्ग नहीं है। बंद रास्ते बहाल करें या वैकल्पिक पड़ाव हटाएँ।";
 if(session.pending)return"वर्तमान लिफ़्ट या सीढ़ियों की यात्रा पूरी होने पर नए उतरने के स्थान से मार्ग फिर बनेगा।";
 if(session.status==="paused")return"सिमुलेशन रुका हुआ है। तैयार होने पर फिर शुरू करें।";
 if(session.revision>0)return"मौजूदा सिमुलेट किए गए स्थान से मार्ग फिर बना दिया गया है।";
 return"सिमुलेशन चल रहा है। यह वास्तविक समय की स्थान ट्रैकिंग नहीं है।";
}

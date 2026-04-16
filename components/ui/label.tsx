import { StyleSheet, Text, View } from "react-native";
import { ThemedText } from "../themed-text";
import { useSettings } from "@/hooks/use-settings";



export function Label(text:string){
    const settings=useSettings()
    const style=StyleSheet.create({
        container: {
            borderLeftWidth: 4,
            borderLeftColor: '#1E5EFF', // blue bar
            paddingLeft: 10,
            paddingVertical: 8,
        },
        label: {
            fontSize: 18,
            fontWeight: '600',
            color: settings.theme=='dark'?'#333':'',
        },
    })
    
    return (
    <View style={style.container}>
      <Text style={style.label}>{text}</Text>
    </View>
    )
}


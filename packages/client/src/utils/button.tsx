import { ReactNode } from "react";
import { Button, ButtonProps, Box } from "@chakra-ui/react";

export function GameButton({
  children,
  isLoading,
  ...rest
}: ButtonProps & { children: ReactNode; isLoading?: boolean }) {
  return (
    <Button
      position="relative"
      overflow="hidden"
      color="white"
      border="1px"
      borderColor="#1A1A1A"
      borderRadius="0"
      _hover={{ backgroundColor: "#141414" }}
      py={5}
      px={3}
      fontSize="16px"
      fontWeight="regular"
      backgroundColor="#0D0D0d"
      {...rest}
    >
      {isLoading && (
        <Box
          position="absolute"
          top="0"
          left="0"
          width="100%"
          height="100%"
          bg="#2A2A2A"
          zIndex="1"
          animation="sideLoadingAnimation 0.9s infinite"
        />
      )}
      <Box position="relative" zIndex="2">
        {children}
      </Box>
    </Button>
  );
}

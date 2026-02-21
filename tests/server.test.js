const { describe, test, expect } = require("@jest/globals");

describe("Open Chat Application Tests", () => {
  
  describe("Room Management", () => {
    test("Room name should be validated", () => {
      const validateRoomName = (name) => {
        return name && name.length >= 2 && name.length <= 30;
      };
      
      expect(validateRoomName("A")).toBe(false);
      expect(validateRoomName("ValidRoom")).toBe(true);
      expect(validateRoomName("")).toBe(false);
      expect(validateRoomName("AB")).toBe(true);
    });
    
    test("Max users should be between 2 and 100", () => {
      const validateMaxUsers = (max) => {
        return max >= 2 && max <= 100;
      };
      
      expect(validateMaxUsers(1)).toBe(false);
      expect(validateMaxUsers(10)).toBe(true);
      expect(validateMaxUsers(101)).toBe(false);
      expect(validateMaxUsers(2)).toBe(true);
      expect(validateMaxUsers(100)).toBe(true);
    });
  });
  
  describe("Username Validation", () => {
    test("Username should be at least 2 characters", () => {
      const validateUsername = (username) => {
        return username && username.length >= 2 && username.length <= 20;
      };
      
      expect(validateUsername("A")).toBe(false);
      expect(validateUsername("User123")).toBe(true);
      expect(validateUsername("")).toBe(false);
    });
  });
  
  describe("Password Validation", () => {
    test("Private room requires password", () => {
      const validatePrivateRoom = (isPrivate, password) => {
        if (isPrivate && !password) return false;
        return true;
      };
      
      expect(validatePrivateRoom(true, "")).toBe(false);
      expect(validatePrivateRoom(true, "pass123")).toBe(true);
      expect(validatePrivateRoom(false, "")).toBe(true);
    });
  });
  
  describe("Room Capacity", () => {
    test("Should not exceed max users", () => {
      const canJoinRoom = (currentUsers, maxUsers) => {
        return currentUsers < maxUsers;
      };
      
      expect(canJoinRoom(10, 10)).toBe(false);
      expect(canJoinRoom(5, 10)).toBe(true);
      expect(canJoinRoom(9, 10)).toBe(true);
    });
  });
  
});
